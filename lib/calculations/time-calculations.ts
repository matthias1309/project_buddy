import type {
  OATimesheet,
  JiraIssue,
  HoursByTeam,
  HoursByCategory,
  EpicHoursEntry,
  BugCostResult,
} from "@/types/domain.types";

export function calcHoursByTeam(entries: OATimesheet[]): HoursByTeam[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (!e.team) continue;
    map.set(e.team, (map.get(e.team) ?? 0) + (e.bookedHours ?? 0));
  }
  return Array.from(map.entries())
    .map(([team, hours]) => ({ team, hours }))
    .sort((a, b) => b.hours - a.hours);
}

export function calcHoursByCategory(entries: OATimesheet[]): HoursByCategory[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (!e.taskCategory) continue;
    map.set(e.taskCategory, (map.get(e.taskCategory) ?? 0) + (e.bookedHours ?? 0));
  }
  return Array.from(map.entries()).map(([category, hours]) => ({ category, hours }));
}

export function calcEpicHours(
  timesheets: OATimesheet[],
  jiraIssues: JiraIssue[],
): EpicHoursEntry[] {
  const issueMap = new Map(jiraIssues.map((i) => [i.issueKey, i]));
  const hoursMap = new Map<string, number>();

  for (const t of timesheets) {
    if (!t.ticketRef) continue;
    hoursMap.set(t.ticketRef, (hoursMap.get(t.ticketRef) ?? 0) + (t.bookedHours ?? 0));
  }

  const DONE_STATUSES = new Set(["done", "released", "cancel", "in approval"]);

  return Array.from(hoursMap.entries())
    .map(([ref, hours]) => {
      const linked = issueMap.get(ref);
      const full = linked?.summary ?? null;
      return {
        ref,
        hours,
        storyPoints: linked?.storyPoints ?? null,
        issueType: linked?.issueType ?? null,
        summaryPreview: full
          ? full.length > 25
            ? full.slice(0, 25) + "…"
            : full
          : null,
        isDone: linked
          ? DONE_STATUSES.has(linked.status.toLowerCase())
          : null,
      };
    })
    .sort((a, b) => b.hours - a.hours);
}

export function calcBugCost(
  timesheets: OATimesheet[],
  jiraIssues: JiraIssue[],
): BugCostResult {
  const issueMap = new Map(jiraIssues.map((i) => [i.issueKey, i]));

  let totalBugHours = 0;
  for (const t of timesheets) {
    if (!t.ticketRef) continue;
    const linked = issueMap.get(t.ticketRef);
    if (linked?.issueType?.toLowerCase() === "bug") {
      totalBugHours += t.bookedHours ?? 0;
    }
  }

  const totalSP = jiraIssues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);

  return {
    totalHours: totalBugHours,
    hoursPerSP: totalSP > 0 ? totalBugHours / totalSP : null,
  };
}
