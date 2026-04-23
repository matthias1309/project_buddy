import type {
  BudgetKPIs,
  ScheduleKPIs,
  ResourceKPIs,
  ScopeKPIs,
  ProjectThresholds,
  StabilityResult,
} from "@/types/domain.types";

export function calcStabilityIndex(
  _kpis: {
    budget: BudgetKPIs;
    schedule: ScheduleKPIs;
    resource: ResourceKPIs;
    scope: ScopeKPIs;
  },
  _thresholds: ProjectThresholds
): StabilityResult {
  throw new Error("Not implemented — Phase 4");
}
