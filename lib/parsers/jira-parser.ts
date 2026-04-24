import * as XLSX from "xlsx";
import type { JiraIssue, JiraSprint, JiraParseResult, ParseError } from "@/types/domain.types";

// Column name candidates (checked case-insensitively, first match wins)
const COL_ISSUE_KEY = ["issue key", "key", "vorgangsschlüssel", "vorgangsschluessel"];
const COL_SUMMARY = ["summary", "zusammenfassung"];
const COL_ISSUE_TYPE = ["issue type", "vorgangstyp"];
const COL_STATUS = ["status"];
const COL_STORY_POINTS = ["story points", "story point estimate"];
const COL_SPRINT = ["sprint"];
const COL_EPIC = ["epic link", "epic-link", "epic"];
const COL_ASSIGNEE = ["assignee", "zugewiesene person"];
const COL_CREATED = ["created", "erstellt"];
const COL_RESOLVED = ["resolved", "gelöst", "geloest"];

const COL_SPRINT_NAME = ["sprint name", "sprint-name", "name"];
const COL_SPRINT_STATE = ["state", "zustand"];
const COL_SPRINT_START = ["start date", "startdatum"];
const COL_SPRINT_END = ["end date", "enddatum"];
const COL_SPRINT_COMPLETED = ["completed points", "fertige punkte"];
const COL_SPRINT_PLANNED = ["planned points", "geplante punkte"];

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

function cellString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function cellNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
}

function cellDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

function isEmptyRow(row: unknown[]): boolean {
  return row.every((cell) => cell === undefined || cell === null || String(cell).trim() === "");
}

function parseIssuesSheet(
  sheet: XLSX.WorkSheet,
  issues: JiraIssue[],
  errors: ParseError[],
): void {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  if (rows.length === 0) return;

  const headerRow = (rows[0] as unknown[]).map((h) => cellString(h));

  const colIssueKey = findColumnIndex(headerRow, COL_ISSUE_KEY);
  const colSummary = findColumnIndex(headerRow, COL_SUMMARY);
  const colIssueType = findColumnIndex(headerRow, COL_ISSUE_TYPE);
  const colStatus = findColumnIndex(headerRow, COL_STATUS);
  const colStoryPoints = findColumnIndex(headerRow, COL_STORY_POINTS);
  const colSprint = findColumnIndex(headerRow, COL_SPRINT);
  const colEpic = findColumnIndex(headerRow, COL_EPIC);
  const colAssignee = findColumnIndex(headerRow, COL_ASSIGNEE);
  const colCreated = findColumnIndex(headerRow, COL_CREATED);
  const colResolved = findColumnIndex(headerRow, COL_RESOLVED);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (isEmptyRow(row)) continue;

    const rowNum = i + 1; // Excel row number (1-based, row 1 = header)

    const issueKey = colIssueKey !== -1 ? cellString(row[colIssueKey]) : "";
    if (!issueKey) {
      errors.push({ row: rowNum, message: `Missing required field "Issue Key" in row ${rowNum}` });
      continue;
    }

    const status = colStatus !== -1 ? cellString(row[colStatus]) : "";
    if (!status) {
      errors.push({ row: rowNum, message: `Missing required field "Status" in row ${rowNum}` });
      continue;
    }

    issues.push({
      issueKey,
      summary: colSummary !== -1 ? cellString(row[colSummary]) || undefined : undefined,
      issueType: colIssueType !== -1 ? cellString(row[colIssueType]) || undefined : undefined,
      status,
      storyPoints: colStoryPoints !== -1 ? cellNumber(row[colStoryPoints]) : undefined,
      sprint: colSprint !== -1 ? cellString(row[colSprint]) || undefined : undefined,
      epic: colEpic !== -1 ? cellString(row[colEpic]) || undefined : undefined,
      assignee: colAssignee !== -1 ? cellString(row[colAssignee]) || undefined : undefined,
      createdDate: colCreated !== -1 ? cellDate(row[colCreated]) : undefined,
      resolvedDate: colResolved !== -1 ? cellDate(row[colResolved]) : undefined,
    });
  }
}

function parseSprintsSheet(sheet: XLSX.WorkSheet, sprints: JiraSprint[]): void {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  if (rows.length === 0) return;

  const headerRow = (rows[0] as unknown[]).map((h) => cellString(h));

  const colName = findColumnIndex(headerRow, COL_SPRINT_NAME);
  const colState = findColumnIndex(headerRow, COL_SPRINT_STATE);
  const colStart = findColumnIndex(headerRow, COL_SPRINT_START);
  const colEnd = findColumnIndex(headerRow, COL_SPRINT_END);
  const colCompleted = findColumnIndex(headerRow, COL_SPRINT_COMPLETED);
  const colPlanned = findColumnIndex(headerRow, COL_SPRINT_PLANNED);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (isEmptyRow(row)) continue;

    const sprintName = colName !== -1 ? cellString(row[colName]) : "";
    if (!sprintName) continue;

    sprints.push({
      sprintName,
      state: colState !== -1 ? cellString(row[colState]) || undefined : undefined,
      startDate: colStart !== -1 ? cellDate(row[colStart]) : undefined,
      endDate: colEnd !== -1 ? cellDate(row[colEnd]) : undefined,
      completedPoints: colCompleted !== -1 ? cellNumber(row[colCompleted]) : undefined,
      plannedPoints: colPlanned !== -1 ? cellNumber(row[colPlanned]) : undefined,
    });
  }
}

export function parseJiraExcel(buffer: Buffer): JiraParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  const issues: JiraIssue[] = [];
  const sprints: JiraSprint[] = [];
  const errors: ParseError[] = [];
  const warnings: string[] = [];

  const issuesSheetName =
    workbook.SheetNames.find((n) => /issue|jira/i.test(n)) ?? workbook.SheetNames[0];

  if (issuesSheetName) {
    parseIssuesSheet(workbook.Sheets[issuesSheetName], issues, errors);
  }

  const sprintsSheetName = workbook.SheetNames.find((n) => /sprint/i.test(n));
  if (sprintsSheetName) {
    parseSprintsSheet(workbook.Sheets[sprintsSheetName], sprints);
  }

  return { issues, sprints, errors, warnings };
}
