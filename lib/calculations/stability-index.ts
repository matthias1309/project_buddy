import type {
  BudgetKPIs,
  ScheduleKPIs,
  ResourceKPIs,
  ScopeKPIs,
  ProjectThresholds,
  StabilityResult,
  StabilityStatus,
  DimensionResult,
  StabilityDimension,
} from "@/types/domain.types";

function classify(
  value: number,
  yellow: number,
  red: number,
): StabilityStatus {
  if (value > red) return "red";
  if (value > yellow) return "yellow";
  return "green";
}

function dimension(
  name: StabilityDimension,
  value: number,
  yellow: number,
  red: number,
): DimensionResult {
  return {
    dimension: name,
    status: classify(value, yellow, red),
    value,
    threshold: { yellow, red },
  };
}

export function calcStabilityIndex(
  kpis: {
    budget: BudgetKPIs;
    schedule: ScheduleKPIs;
    resource: ResourceKPIs;
    scope: ScopeKPIs;
  },
  thresholds: ProjectThresholds,
): StabilityResult {
  const dimensions: DimensionResult[] = [
    dimension(
      "budget",
      kpis.budget.differencePct,
      thresholds.budgetYellowPct,
      thresholds.budgetRedPct,
    ),
    dimension(
      "schedule",
      kpis.schedule.maxDelayDays,
      thresholds.scheduleYellowDays,
      thresholds.scheduleRedDays,
    ),
    dimension(
      "resource",
      kpis.resource.overallUtilizationPct,
      thresholds.resourceYellowPct,
      thresholds.resourceRedPct,
    ),
    dimension(
      "scope",
      kpis.scope.scopeGrowthPct,
      thresholds.scopeYellowPct,
      thresholds.scopeRedPct,
    ),
  ];

  const redCount = dimensions.filter((d) => d.status === "red").length;
  const yellowCount = dimensions.filter((d) => d.status === "yellow").length;

  const status: StabilityStatus =
    redCount > 0 ? "red" : yellowCount > 0 ? "yellow" : "green";

  const score = Math.max(0, 100 - redCount * 30 - yellowCount * 10);

  return { status, score, dimensions };
}
