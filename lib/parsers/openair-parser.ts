import * as XLSX from "xlsx";
import type {
  OATimesheet,
  OAMilestone,
  OABudgetEntry,
  OpenAirParseResult,
} from "@/types/domain.types";

// Column candidates (checked case-insensitively, first match wins)
const COL_EMPLOYEE = ["mitarbeiter", "employee"];
const COL_ROLE = ["rolle", "role", "job code"];
const COL_PHASE = ["phase", "task"];
const COL_PLANNED_HOURS = ["geplante stunden", "planned hours", "budget hours"];
const COL_BOOKED_HOURS = ["gebuchte stunden", "actual hours", "hours"];
const COL_PERIOD = ["datum", "date", "period", "periode"];

const COL_CATEGORY = ["kategorie", "category"];
const COL_PLANNED_EUR = ["geplant (eur)", "planned (eur)", "geplant eur", "planned eur", "budget"];
const COL_ACTUAL_EUR = ["ist (eur)", "actual (eur)", "ist eur", "actual eur", "actual"];

const COL_MILESTONE_NAME = ["name"];
const COL_PLANNED_DATE = ["geplant", "planned date", "planned"];
const COL_ACTUAL_DATE = ["aktuell", "actual date"];
const COL_STATUS = ["status"];

// --- Utilities (shared with jira-parser, duplicated to keep modules independent) ---

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

// --- Block type detection ---

type BlockType = "timesheets" | "budget" | "milestones" | null;

function detectBlockType(headers: string[]): BlockType {
  const norm = headers.map((h) => h.toLowerCase().trim()).filter(Boolean);

  const hasEmployee = COL_EMPLOYEE.some((c) => norm.includes(c));
  const hasHours = [...COL_PLANNED_HOURS, ...COL_BOOKED_HOURS].some((c) => norm.includes(c));
  if (hasEmployee || hasHours) return "timesheets";

  const hasCategory = COL_CATEGORY.some((c) => norm.includes(c));
  const hasEur = norm.some((h) => h.includes("eur") || h.includes("budget"));
  if (hasCategory || hasEur) return "budget";

  const hasName = COL_MILESTONE_NAME.some((c) => norm.includes(c));
  const hasPlannedDate = COL_PLANNED_DATE.some((c) => norm.includes(c));
  if (hasName && hasPlannedDate) return "milestones";

  return null;
}

// --- Timesheets ---

function parseTimesheetRows(
  rows: unknown[][],
  startRow: number,
  timesheets: OATimesheet[],
  warnings: string[],
): void {
  const headerRow = (rows[startRow] as unknown[]).map((h) => cellString(h));

  const colEmployee = findColumnIndex(headerRow, COL_EMPLOYEE);
  const colRole = findColumnIndex(headerRow, COL_ROLE);
  const colPhase = findColumnIndex(headerRow, COL_PHASE);
  const colPlanned = findColumnIndex(headerRow, COL_PLANNED_HOURS);
  const colBooked = findColumnIndex(headerRow, COL_BOOKED_HOURS);
  const colPeriod = findColumnIndex(headerRow, COL_PERIOD);

  for (let i = startRow + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (isEmptyRow(row)) continue;

    // Stop if we hit another header block
    const rowHeaders = row.map((h) => cellString(h));
    if (detectBlockType(rowHeaders) !== null && i !== startRow + 1) break;

    const bookedHours = colBooked !== -1 ? cellNumber(row[colBooked]) : undefined;

    if (bookedHours !== undefined && bookedHours < 0) {
      warnings.push(
        `Negative booked hours (${bookedHours}) in timesheet row ${i + 1}`,
      );
    }

    timesheets.push({
      employeeName: colEmployee !== -1 ? cellString(row[colEmployee]) || undefined : undefined,
      role: colRole !== -1 ? cellString(row[colRole]) || undefined : undefined,
      phase: colPhase !== -1 ? cellString(row[colPhase]) || undefined : undefined,
      plannedHours: colPlanned !== -1 ? cellNumber(row[colPlanned]) : undefined,
      bookedHours,
      periodDate: colPeriod !== -1 ? cellDate(row[colPeriod]) : undefined,
    });
  }
}

// --- Budget ---

function parseBudgetRows(
  rows: unknown[][],
  startRow: number,
  budgetEntries: OABudgetEntry[],
  warnings: string[],
): void {
  const headerRow = (rows[startRow] as unknown[]).map((h) => cellString(h));

  const colCategory = findColumnIndex(headerRow, COL_CATEGORY);
  const colPlanned = findColumnIndex(headerRow, COL_PLANNED_EUR);
  const colActual = findColumnIndex(headerRow, COL_ACTUAL_EUR);
  const colPeriod = findColumnIndex(headerRow, COL_PERIOD);

  for (let i = startRow + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (isEmptyRow(row)) continue;

    const plannedEur = colPlanned !== -1 ? cellNumber(row[colPlanned]) : undefined;
    const actualEur = colActual !== -1 ? cellNumber(row[colActual]) : undefined;

    if (plannedEur === undefined || actualEur === undefined) {
      warnings.push(`Budget entry in row ${i + 1} is missing planned or actual value`);
    }

    budgetEntries.push({
      category: colCategory !== -1 ? cellString(row[colCategory]) || undefined : undefined,
      plannedEur,
      actualEur,
      periodDate: colPeriod !== -1 ? cellDate(row[colPeriod]) : undefined,
    });
  }
}

// --- Milestones ---

function parseMilestoneRows(
  rows: unknown[][],
  startRow: number,
  milestones: OAMilestone[],
): void {
  const headerRow = (rows[startRow] as unknown[]).map((h) => cellString(h));

  const colName = findColumnIndex(headerRow, COL_MILESTONE_NAME);
  const colPlanned = findColumnIndex(headerRow, COL_PLANNED_DATE);
  const colActual = findColumnIndex(headerRow, COL_ACTUAL_DATE);
  const colStatus = findColumnIndex(headerRow, COL_STATUS);

  for (let i = startRow + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (isEmptyRow(row)) continue;

    const name = colName !== -1 ? cellString(row[colName]) : "";
    if (!name) continue;

    milestones.push({
      name,
      plannedDate: colPlanned !== -1 ? cellDate(row[colPlanned]) : undefined,
      actualDate: colActual !== -1 ? cellDate(row[colActual]) : undefined,
      status: colStatus !== -1 ? cellString(row[colStatus]) || undefined : undefined,
    });
  }
}

// --- Sheet dispatcher ---

function dispatchSheet(
  sheetName: string,
  rows: unknown[][],
  timesheets: OATimesheet[],
  budgetEntries: OABudgetEntry[],
  milestones: OAMilestone[],
  warnings: string[],
  foundBudget: { value: boolean },
): void {
  if (rows.length === 0) return;

  // Named sheet detection
  if (/timesheet|stunden/i.test(sheetName)) {
    parseTimesheetRows(rows, 0, timesheets, warnings);
    return;
  }
  if (/budget|kosten/i.test(sheetName)) {
    parseBudgetRows(rows, 0, budgetEntries, warnings);
    foundBudget.value = true;
    return;
  }
  if (/milestone|meilenstein/i.test(sheetName)) {
    parseMilestoneRows(rows, 0, milestones);
    return;
  }

  // Fallback: scan the sheet for block headers
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (isEmptyRow(row)) continue;

    const headers = row.map((h) => cellString(h));
    const blockType = detectBlockType(headers);

    if (blockType === "timesheets") {
      parseTimesheetRows(rows, i, timesheets, warnings);
      return;
    }
    if (blockType === "budget") {
      parseBudgetRows(rows, i, budgetEntries, warnings);
      foundBudget.value = true;
      return;
    }
    if (blockType === "milestones") {
      parseMilestoneRows(rows, i, milestones);
      return;
    }
  }
}

// --- Public API ---

export function parseOpenAirExcel(buffer: Buffer): OpenAirParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  const timesheets: OATimesheet[] = [];
  const milestones: OAMilestone[] = [];
  const budgetEntries: OABudgetEntry[] = [];
  const warnings: string[] = [];
  const foundBudget = { value: false };

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    dispatchSheet(sheetName, rows, timesheets, budgetEntries, milestones, warnings, foundBudget);
  }

  if (!foundBudget.value) {
    warnings.push("Budget data not found — budget KPIs cannot be calculated");
  }

  return { timesheets, milestones, budgetEntries, errors: [], warnings };
}
