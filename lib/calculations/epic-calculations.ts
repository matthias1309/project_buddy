import type {
  OATimesheet,
  JiraIssue,
  EpicBudgetRow,
  EpicBudgetSummary,
  EpicBudgetStatus,
} from "@/types/domain.types";

export interface TimesheetFilter {
  team?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export function filterTimesheets(
  timesheets: OATimesheet[],
  filter: TimesheetFilter,
): OATimesheet[] {
  const { team, dateFrom, dateTo } = filter;
  return timesheets.filter((t) => {
    if (team !== undefined && t.team !== team) return false;
    if (dateFrom !== undefined) {
      if (!t.periodDate || t.periodDate < dateFrom) return false;
    }
    if (dateTo !== undefined) {
      if (!t.periodDate || t.periodDate > dateTo) return false;
    }
    return true;
  });
}

function epicStatus(usagePct: number, warningMarginPct: number): EpicBudgetStatus {
  if (usagePct >= 100) return "red";
  if (usagePct >= 100 - warningMarginPct) return "yellow";
  return "green";
}

export function calcEpicBudget(
  epics: JiraIssue[],
  allIssues: JiraIssue[],
  timesheets: OATimesheet[],
  warningMarginPct: number,
): EpicBudgetRow[] {
  // story issueKey → epic issueKey
  const storyToEpic = new Map<string, string>();
  for (const issue of allIssues) {
    if (issue.epic) storyToEpic.set(issue.issueKey, issue.epic);
  }

  // epic issueKey → total booked hours
  const epicHours = new Map<string, number>();
  for (const t of timesheets) {
    if (!t.ticketRef) continue;
    const epicKey = storyToEpic.get(t.ticketRef);
    if (!epicKey) continue;
    epicHours.set(epicKey, (epicHours.get(epicKey) ?? 0) + (t.bookedHours ?? 0));
  }

  const rows: EpicBudgetRow[] = epics.map((epic) => {
    const bookedHours = epicHours.get(epic.issueKey) ?? 0;
    const bookedDays = bookedHours / 8;
    const plannedDays = epic.tShirtDays ?? null;
    const usagePct = plannedDays !== null ? (bookedDays / plannedDays) * 100 : null;
    const status: EpicBudgetStatus =
      usagePct === null ? "unknown" : epicStatus(usagePct, warningMarginPct);

    return {
      epicKey: epic.issueKey,
      epicName: epic.summary ?? null,
      plannedDays,
      bookedHours,
      bookedDays,
      usagePct,
      status,
    };
  });

  return rows.sort((a, b) => {
    if (a.usagePct === null && b.usagePct === null) return 0;
    if (a.usagePct === null) return 1;
    if (b.usagePct === null) return -1;
    return b.usagePct - a.usagePct;
  });
}

export function calcEpicTileSummary(rows: EpicBudgetRow[]): EpicBudgetSummary {
  let overbooked = 0;
  let nearLimit = 0;
  for (const row of rows) {
    if (row.status === "red") overbooked++;
    else if (row.status === "yellow") nearLimit++;
  }
  return { overbooked, nearLimit };
}
