import type {
  BudgetKPIs,
  ScheduleKPIs,
  ResourceKPIs,
  ScopeKPIs,
  OABudgetEntry,
  OAMilestone,
  OATimesheet,
  JiraIssue,
  JiraSprint,
} from "@/types/domain.types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

// ─────────────────────────────────────────────
// Budget
// ─────────────────────────────────────────────

export function calcBudgetKPIs(
  budgetEntries: OABudgetEntry[],
  totalBudget: number,
): BudgetKPIs {
  let plannedEur = 0;
  let actualEur = 0;

  for (const e of budgetEntries) {
    plannedEur += e.plannedEur ?? 0;
    actualEur += e.actualEur ?? 0;
  }

  const differenceEur = actualEur - plannedEur;
  const differencePct = plannedEur === 0 ? 0 : (differenceEur / plannedEur) * 100;

  // Burn rate: actual / elapsed days * 30 (monthly projection)
  const dates = budgetEntries
    .map((e) => e.periodDate)
    .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));

  let burnRate = 0;
  if (dates.length > 0) {
    const minMs = Math.min(...dates.map((d) => d.getTime()));
    const maxMs = Math.max(...dates.map((d) => d.getTime()));
    const elapsedDays = Math.max((maxMs - minMs) / MS_PER_DAY, 1);
    burnRate = (actualEur / elapsedDays) * 30;
  }

  // EAC (simplified): actual + remaining planned budget
  const eac = actualEur > 0 || plannedEur > 0
    ? actualEur + (totalBudget - plannedEur)
    : 0;

  return { plannedEur, actualEur, differenceEur, differencePct, burnRate, eac };
}

// ─────────────────────────────────────────────
// Schedule
// ─────────────────────────────────────────────

export function calcScheduleKPIs(
  milestones: OAMilestone[],
  _today: Date,
): ScheduleKPIs {
  let delayedMilestones = 0;
  let maxDelayDays = 0;

  for (const m of milestones) {
    if (m.actualDate && m.plannedDate && m.actualDate > m.plannedDate) {
      delayedMilestones++;
      const delay = daysBetween(m.plannedDate, m.actualDate);
      if (delay > maxDelayDays) maxDelayDays = delay;
    }
  }

  // Next milestone: earliest non-completed, by plannedDate
  const nonCompleted = milestones
    .filter((m) => m.status !== "completed")
    .sort((a, b) => {
      const aMs = a.plannedDate?.getTime() ?? Infinity;
      const bMs = b.plannedDate?.getTime() ?? Infinity;
      return aMs - bMs;
    });

  return {
    totalMilestones: milestones.length,
    delayedMilestones,
    maxDelayDays,
    nextMilestone: nonCompleted[0] ?? null,
  };
}

// ─────────────────────────────────────────────
// Resources
// ─────────────────────────────────────────────

export function calcResourceKPIs(timesheets: OATimesheet[]): ResourceKPIs {
  const roleMap = new Map<string, { planned: number; booked: number }>();
  let totalPlanned = 0;
  let totalBooked = 0;

  for (const ts of timesheets) {
    const planned = ts.plannedHours ?? 0;
    const booked = ts.bookedHours ?? 0;
    totalPlanned += planned;
    totalBooked += booked;

    if (ts.role) {
      const entry = roleMap.get(ts.role) ?? { planned: 0, booked: 0 };
      entry.planned += planned;
      entry.booked += booked;
      roleMap.set(ts.role, entry);
    }
  }

  const byRole = Array.from(roleMap.entries()).map(([role, { planned, booked }]) => ({
    role,
    plannedHours: planned,
    bookedHours: booked,
    utilizationPct: planned === 0 ? 0 : (booked / planned) * 100,
  }));

  const overallUtilizationPct =
    totalPlanned === 0 ? 0 : (totalBooked / totalPlanned) * 100;

  return { byRole, overallUtilizationPct };
}

// ─────────────────────────────────────────────
// Scope
// ─────────────────────────────────────────────

const CLOSED_STATUSES = new Set([
  "done",
  "closed",
  "resolved",
  "won't fix",
  "wont fix",
]);

export function calcScopeKPIs(
  issues: JiraIssue[],
  sprints: JiraSprint[],
): ScopeKPIs {
  const totalIssues = issues.length;

  let openIssues = 0;
  let totalStoryPoints = 0;
  let completedStoryPoints = 0;
  let bugCount = 0;

  for (const issue of issues) {
    const isClosed = CLOSED_STATUSES.has(issue.status.toLowerCase());
    if (!isClosed) openIssues++;

    const pts = issue.storyPoints ?? 0;
    totalStoryPoints += pts;
    if (isClosed) completedStoryPoints += pts;

    if (issue.issueType?.toLowerCase() === "bug") bugCount++;
  }

  const completionPct =
    totalStoryPoints === 0 ? 0 : (completedStoryPoints / totalStoryPoints) * 100;
  const bugRate = totalIssues === 0 ? 0 : (bugCount / totalIssues) * 100;

  // Velocity trend: last 3 sprints' completedPoints (in input order)
  const velocityTrend = sprints
    .slice(-3)
    .map((s) => s.completedPoints ?? 0);

  // Scope growth: (currentPoints - plannedPoints) / plannedPoints * 100
  const totalPlannedPoints = sprints.reduce((sum, s) => sum + (s.plannedPoints ?? 0), 0);
  const scopeGrowthPct =
    totalPlannedPoints === 0
      ? 0
      : ((totalStoryPoints - totalPlannedPoints) / totalPlannedPoints) * 100;

  return {
    totalIssues,
    openIssues,
    totalStoryPoints,
    completedStoryPoints,
    completionPct,
    velocityTrend,
    bugRate,
    scopeGrowthPct,
  };
}
