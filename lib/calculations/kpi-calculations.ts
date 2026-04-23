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

export function calcBudgetKPIs(
  _budgetEntries: OABudgetEntry[],
  _totalBudget: number
): BudgetKPIs {
  throw new Error("Not implemented — Phase 4");
}

export function calcScheduleKPIs(
  _milestones: OAMilestone[],
  _today: Date
): ScheduleKPIs {
  throw new Error("Not implemented — Phase 4");
}

export function calcResourceKPIs(_timesheets: OATimesheet[]): ResourceKPIs {
  throw new Error("Not implemented — Phase 4");
}

export function calcScopeKPIs(
  _issues: JiraIssue[],
  _sprints: JiraSprint[]
): ScopeKPIs {
  throw new Error("Not implemented — Phase 4");
}
