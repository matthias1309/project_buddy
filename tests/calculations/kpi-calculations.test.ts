import { describe, it, expect } from "vitest";
import {
  calcBudgetKPIs,
  calcScheduleKPIs,
  calcResourceKPIs,
  calcScopeKPIs,
} from "@/lib/calculations/kpi-calculations";
import type {
  OABudgetEntry,
  OAMilestone,
  OATimesheet,
  JiraIssue,
  JiraSprint,
} from "@/types/domain.types";

// ─────────────────────────────────────────────
// calcBudgetKPIs
// ─────────────────────────────────────────────

describe("calcBudgetKPIs", () => {
  const BASE_ENTRIES: OABudgetEntry[] = [
    { category: "Personal", plannedEur: 80_000, actualEur: 60_000, periodDate: new Date("2024-01-31") },
    { category: "Reise",    plannedEur: 5_000,  actualEur: 3_000,  periodDate: new Date("2024-02-29") },
    { category: "Lizenzen", plannedEur: 10_000, actualEur: 10_000, periodDate: new Date("2024-03-31") },
    { category: "Sonstiges",plannedEur: 5_000,  actualEur: 2_000,  periodDate: new Date("2024-03-31") },
  ];
  const TOTAL_BUDGET = 120_000;

  it("sums planned and actual correctly", () => {
    const r = calcBudgetKPIs(BASE_ENTRIES, TOTAL_BUDGET);
    expect(r.plannedEur).toBe(100_000);
    expect(r.actualEur).toBe(75_000);
  });

  it("computes differenceEur and differencePct (under budget)", () => {
    const r = calcBudgetKPIs(BASE_ENTRIES, TOTAL_BUDGET);
    expect(r.differenceEur).toBe(-25_000); // actual - planned = under budget
    expect(r.differencePct).toBeCloseTo(-25, 1);
  });

  it("computes differenceEur and differencePct when over budget", () => {
    const overEntries: OABudgetEntry[] = [
      { plannedEur: 10_000, actualEur: 13_000 },
    ];
    const r = calcBudgetKPIs(overEntries, 15_000);
    expect(r.differenceEur).toBe(3_000);
    expect(r.differencePct).toBeCloseTo(30, 1);
  });

  it("computes EAC as actual + (totalBudget − planned)", () => {
    // EAC = 75000 + (120000 - 100000) = 95000
    const r = calcBudgetKPIs(BASE_ENTRIES, TOTAL_BUDGET);
    expect(r.eac).toBe(95_000);
  });

  it("computes burnRate from period dates (monthly)", () => {
    // elapsed: Jan 31 → Mar 31 = 59 days; burnRate = 75000 / 59 * 30 ≈ 38135
    const r = calcBudgetKPIs(BASE_ENTRIES, TOTAL_BUDGET);
    expect(r.burnRate).toBeGreaterThan(0);
  });

  it("returns burnRate 0 when no period dates are present", () => {
    const entries: OABudgetEntry[] = [
      { plannedEur: 10_000, actualEur: 8_000 },
    ];
    const r = calcBudgetKPIs(entries, 15_000);
    expect(r.burnRate).toBe(0);
  });

  it("returns all zeros for empty entries", () => {
    const r = calcBudgetKPIs([], 100_000);
    expect(r.plannedEur).toBe(0);
    expect(r.actualEur).toBe(0);
    expect(r.differenceEur).toBe(0);
    expect(r.differencePct).toBe(0);
    expect(r.burnRate).toBe(0);
    expect(r.eac).toBe(0);
  });

  it("handles plannedEur = 0 without dividing by zero (differencePct = 0)", () => {
    const entries: OABudgetEntry[] = [{ plannedEur: 0, actualEur: 5_000 }];
    const r = calcBudgetKPIs(entries, 10_000);
    expect(r.differencePct).toBe(0);
  });

  it("ignores entries with undefined planned/actual", () => {
    const entries: OABudgetEntry[] = [
      { plannedEur: 5_000, actualEur: 4_000 },
      { plannedEur: undefined, actualEur: undefined },
    ];
    const r = calcBudgetKPIs(entries, 10_000);
    expect(r.plannedEur).toBe(5_000);
    expect(r.actualEur).toBe(4_000);
  });
});

// ─────────────────────────────────────────────
// calcScheduleKPIs
// ─────────────────────────────────────────────

describe("calcScheduleKPIs", () => {
  const MILESTONES: OAMilestone[] = [
    { name: "Kick-off",      plannedDate: new Date("2024-01-05"), actualDate: new Date("2024-01-05"), status: "completed" },
    { name: "Design-Abnahme",plannedDate: new Date("2024-02-15"), actualDate: new Date("2024-02-20"), status: "completed" }, // delayed 5 days
    { name: "Go-Live",       plannedDate: new Date("2024-04-01"), actualDate: new Date("2024-04-15"), status: "delayed" },  // delayed 14 days
    { name: "Retrospektive", plannedDate: new Date("2024-05-01"),                                     status: "open" },    // future
  ];

  it("counts total milestones correctly", () => {
    const r = calcScheduleKPIs(MILESTONES);
    expect(r.totalMilestones).toBe(4);
  });

  it("counts milestones where actualDate > plannedDate as delayed", () => {
    const r = calcScheduleKPIs(MILESTONES);
    expect(r.delayedMilestones).toBe(2); // Design-Abnahme + Go-Live
  });

  it("computes maxDelayDays as the largest delay", () => {
    const r = calcScheduleKPIs(MILESTONES);
    expect(r.maxDelayDays).toBe(14); // Go-Live: Apr 15 − Apr 1
  });

  it("identifies the next non-completed milestone with the earliest planned date", () => {
    const r = calcScheduleKPIs(MILESTONES);
    // Go-Live (status=delayed) has plannedDate Apr 1; Retrospektive has May 1 – Go-Live is earlier
    expect(r.nextMilestone).not.toBeNull();
    expect(r.nextMilestone?.name).toBe("Go-Live");
  });

  it("returns nextMilestone null when all milestones are completed", () => {
    const allDone: OAMilestone[] = [
      { name: "M1", plannedDate: new Date("2024-01-01"), status: "completed" },
    ];
    const r = calcScheduleKPIs(allDone);
    expect(r.nextMilestone).toBeNull();
  });

  it("returns zeros and null for empty milestones", () => {
    const r = calcScheduleKPIs([]);
    expect(r.totalMilestones).toBe(0);
    expect(r.delayedMilestones).toBe(0);
    expect(r.maxDelayDays).toBe(0);
    expect(r.nextMilestone).toBeNull();
  });

  it("does not count milestone as delayed when actualDate equals plannedDate", () => {
    const milestones: OAMilestone[] = [
      { name: "M1", plannedDate: new Date("2024-03-01"), actualDate: new Date("2024-03-01"), status: "completed" },
    ];
    const r = calcScheduleKPIs(milestones);
    expect(r.delayedMilestones).toBe(0);
    expect(r.maxDelayDays).toBe(0);
  });

  it("handles milestones without actualDate (no delay)", () => {
    const milestones: OAMilestone[] = [
      { name: "Future", plannedDate: new Date("2024-06-01"), status: "open" },
    ];
    const r = calcScheduleKPIs(milestones);
    expect(r.delayedMilestones).toBe(0);
  });
});

// ─────────────────────────────────────────────
// calcResourceKPIs
// ─────────────────────────────────────────────

describe("calcResourceKPIs", () => {
  const TIMESHEETS: OATimesheet[] = [
    { role: "Senior Consultant", plannedHours: 100, bookedHours: 90 },
    { role: "Senior Consultant", plannedHours: 60,  bookedHours: 70 },  // total SC: 160 / 160 → 100%... wait: planned=160, booked=160
    { role: "Consultant",        plannedHours: 80,  bookedHours: 60 },
    { role: "Consultant",        plannedHours: 40,  bookedHours: 50 },
    { role: "Projektleiter",     plannedHours: 20,  bookedHours: 22 },
  ];

  it("aggregates hours correctly per role", () => {
    const r = calcResourceKPIs(TIMESHEETS);
    const sc = r.byRole.find((x) => x.role === "Senior Consultant");
    expect(sc?.plannedHours).toBe(160);
    expect(sc?.bookedHours).toBe(160);
  });

  it("computes utilizationPct per role", () => {
    const r = calcResourceKPIs(TIMESHEETS);
    const consultant = r.byRole.find((x) => x.role === "Consultant");
    // planned=120, booked=110 → 110/120*100 ≈ 91.67%
    expect(consultant?.utilizationPct).toBeCloseTo(91.67, 1);
  });

  it("computes overallUtilizationPct across all roles", () => {
    const r = calcResourceKPIs(TIMESHEETS);
    // total planned = 160+120+20 = 300; booked = 160+110+22 = 292
    expect(r.overallUtilizationPct).toBeCloseTo((292 / 300) * 100, 1);
  });

  it("returns empty byRole and 0% overall for empty timesheets", () => {
    const r = calcResourceKPIs([]);
    expect(r.byRole).toHaveLength(0);
    expect(r.overallUtilizationPct).toBe(0);
  });

  it("handles plannedHours = 0 without dividing by zero (utilizationPct = 0)", () => {
    const r = calcResourceKPIs([{ role: "X", plannedHours: 0, bookedHours: 5 }]);
    const row = r.byRole[0];
    expect(row.utilizationPct).toBe(0);
  });

  it("skips rows without a role when computing byRole breakdown", () => {
    const ts: OATimesheet[] = [
      { role: "Dev", plannedHours: 40, bookedHours: 40 },
      { plannedHours: 10, bookedHours: 10 }, // no role → skip
    ];
    const r = calcResourceKPIs(ts);
    expect(r.byRole).toHaveLength(1);
  });

  it("includes rows without role in the overall totals", () => {
    const ts: OATimesheet[] = [
      { role: "Dev", plannedHours: 40, bookedHours: 40 },
      { plannedHours: 10, bookedHours: 5 }, // no role but still has hours
    ];
    const r = calcResourceKPIs(ts);
    // overall: planned=50, booked=45 → 90%
    expect(r.overallUtilizationPct).toBeCloseTo(90, 1);
  });
});

// ─────────────────────────────────────────────
// calcScopeKPIs
// ─────────────────────────────────────────────

describe("calcScopeKPIs", () => {
  const ISSUES: JiraIssue[] = [
    { issueKey: "P-1", status: "Done",        issueType: "Story", storyPoints: 5  },
    { issueKey: "P-2", status: "Done",        issueType: "Task",  storyPoints: 3  },
    { issueKey: "P-3", status: "In Progress", issueType: "Story", storyPoints: 8  },
    { issueKey: "P-4", status: "To Do",       issueType: "Bug",   storyPoints: 2  },
    { issueKey: "P-5", status: "In Progress", issueType: "Bug",   storyPoints: 1  },
  ];

  const SPRINTS: JiraSprint[] = [
    { sprintName: "Sprint 1", completedPoints: 10 },
    { sprintName: "Sprint 2", completedPoints: 15 },
    { sprintName: "Sprint 3", completedPoints: 8  },
  ];

  it("counts total and open issues correctly", () => {
    const r = calcScopeKPIs(ISSUES, SPRINTS);
    expect(r.totalIssues).toBe(5);
    expect(r.openIssues).toBe(3); // In Progress × 2 + To Do × 1
  });

  it("sums story points and computes completionPct", () => {
    const r = calcScopeKPIs(ISSUES, SPRINTS);
    expect(r.totalStoryPoints).toBe(19);
    expect(r.completedStoryPoints).toBe(8); // P-1 + P-2
    expect(r.completionPct).toBeCloseTo((8 / 19) * 100, 1);
  });

  it("computes velocityTrend from last 3 sprints in order", () => {
    const r = calcScopeKPIs(ISSUES, SPRINTS);
    expect(r.velocityTrend).toEqual([10, 15, 8]);
  });

  it("returns only available sprints when fewer than 3 exist", () => {
    const r = calcScopeKPIs(ISSUES, [{ sprintName: "S1", completedPoints: 12 }]);
    expect(r.velocityTrend).toEqual([12]);
  });

  it("computes bugRate as percentage of issues that are Bugs", () => {
    const r = calcScopeKPIs(ISSUES, SPRINTS);
    // 2 bugs out of 5 → 40%
    expect(r.bugRate).toBeCloseTo(40, 1);
  });

  it("returns all zeros for empty issues", () => {
    const r = calcScopeKPIs([], []);
    expect(r.totalIssues).toBe(0);
    expect(r.openIssues).toBe(0);
    expect(r.totalStoryPoints).toBe(0);
    expect(r.completedStoryPoints).toBe(0);
    expect(r.completionPct).toBe(0);
    expect(r.velocityTrend).toEqual([]);
    expect(r.bugRate).toBe(0);
  });

  it("handles issues without storyPoints (counted in total but 0 points)", () => {
    const issues: JiraIssue[] = [
      { issueKey: "P-1", status: "Done" },
      { issueKey: "P-2", status: "To Do", storyPoints: 5 },
    ];
    const r = calcScopeKPIs(issues, []);
    expect(r.totalIssues).toBe(2);
    expect(r.totalStoryPoints).toBe(5);
    expect(r.completedStoryPoints).toBe(0); // Done issue has no points
  });

  it("completionPct is 0 when totalStoryPoints is 0 (no division by zero)", () => {
    const issues: JiraIssue[] = [{ issueKey: "P-1", status: "Done" }];
    const r = calcScopeKPIs(issues, []);
    expect(r.completionPct).toBe(0);
  });

  it("velocityTrend takes only the last 3 when more than 3 sprints exist", () => {
    const manySprints: JiraSprint[] = [
      { sprintName: "S1", completedPoints: 5  },
      { sprintName: "S2", completedPoints: 7  },
      { sprintName: "S3", completedPoints: 9  },
      { sprintName: "S4", completedPoints: 11 },
      { sprintName: "S5", completedPoints: 13 },
    ];
    const r = calcScopeKPIs([], manySprints);
    expect(r.velocityTrend).toEqual([9, 11, 13]);
  });

  it("scopeGrowthPct is 0 when sprints have no plannedPoints (baseline unavailable)", () => {
    // SPRINTS fixture only has completedPoints, no plannedPoints → baseline = 0
    const r = calcScopeKPIs(ISSUES, SPRINTS);
    expect(r.scopeGrowthPct).toBe(0);
  });

  it("scopeGrowthPct is 0 when no sprint planned points exist", () => {
    const sprints: JiraSprint[] = [{ sprintName: "S1" }]; // no plannedPoints
    const r = calcScopeKPIs(ISSUES, sprints);
    expect(r.scopeGrowthPct).toBe(0);
  });

  it("scopeGrowthPct is positive when more issues added than sprint baseline", () => {
    const sprints: JiraSprint[] = [{ sprintName: "S1", plannedPoints: 10 }];
    const issues: JiraIssue[] = [
      { issueKey: "P-1", status: "Done", storyPoints: 7 },
      { issueKey: "P-2", status: "To Do", storyPoints: 7 }, // total=14 > planned=10
    ];
    const r = calcScopeKPIs(issues, sprints);
    expect(r.scopeGrowthPct).toBeCloseTo(40, 1); // (14-10)/10*100
  });
});
