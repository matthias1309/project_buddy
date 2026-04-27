import { describe, it, expect } from "vitest";
import { calcStabilityIndex } from "@/lib/calculations/stability-index";
import type {
  BudgetKPIs,
  ScheduleKPIs,
  ResourceKPIs,
  ScopeKPIs,
  ProjectThresholds,
} from "@/types/domain.types";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS: ProjectThresholds = {
  budgetYellowPct: 15,
  budgetRedPct: 25,
  scheduleYellowDays: 5,
  scheduleRedDays: 15,
  resourceYellowPct: 85,
  resourceRedPct: 100,
  scopeYellowPct: 10,
  scopeRedPct: 20,
  epicWarningMarginPct: 10,
};

// Build minimal KPI stubs; only the fields the stability index actually reads.
function makeKPIs({
  budgetDifferencePct = 0,
  maxDelayDays = 0,
  overallUtilizationPct = 70,
  scopeGrowthPct = 0,
}: {
  budgetDifferencePct?: number;
  maxDelayDays?: number;
  overallUtilizationPct?: number;
  scopeGrowthPct?: number;
} = {}): {
  budget: BudgetKPIs;
  schedule: ScheduleKPIs;
  resource: ResourceKPIs;
  scope: ScopeKPIs;
} {
  return {
    budget: {
      plannedEur: 100_000,
      actualEur: 100_000,
      differenceEur: 0,
      differencePct: budgetDifferencePct,
      burnRate: 0,
      eac: 100_000,
    },
    schedule: {
      totalMilestones: 3,
      delayedMilestones: 0,
      maxDelayDays,
      nextMilestone: null,
    },
    resource: {
      byRole: [],
      overallUtilizationPct,
    },
    scope: {
      totalIssues: 20,
      openIssues: 10,
      totalStoryPoints: 100,
      completedStoryPoints: 50,
      completionPct: 50,
      velocityTrend: [10, 10, 10],
      bugRate: 10,
      scopeGrowthPct,
    },
  };
}

// ─── Overall status ──────────────────────────────────────────────────────────

describe("calcStabilityIndex — overall status", () => {
  it("returns green when all dimensions are within thresholds", () => {
    const r = calcStabilityIndex(makeKPIs(), DEFAULT_THRESHOLDS);
    expect(r.status).toBe("green");
  });

  it("returns yellow when exactly one dimension is yellow and none are red", () => {
    const r = calcStabilityIndex(
      makeKPIs({ budgetDifferencePct: 20 }), // 20 > yellow(15), < red(25)
      DEFAULT_THRESHOLDS,
    );
    expect(r.status).toBe("yellow");
  });

  it("returns red when exactly one dimension is red", () => {
    const r = calcStabilityIndex(
      makeKPIs({ budgetDifferencePct: 30 }), // 30 > red(25)
      DEFAULT_THRESHOLDS,
    );
    expect(r.status).toBe("red");
  });

  it("returns red even when other dimensions are only yellow (red takes priority)", () => {
    const r = calcStabilityIndex(
      makeKPIs({ budgetDifferencePct: 30, maxDelayDays: 10 }), // budget red, schedule yellow
      DEFAULT_THRESHOLDS,
    );
    expect(r.status).toBe("red");
  });

  it("returns yellow when two dimensions are yellow and none are red", () => {
    const r = calcStabilityIndex(
      makeKPIs({ budgetDifferencePct: 20, maxDelayDays: 10 }),
      DEFAULT_THRESHOLDS,
    );
    expect(r.status).toBe("yellow");
  });
});

// ─── Score ───────────────────────────────────────────────────────────────────

describe("calcStabilityIndex — score", () => {
  it("returns 100 when all dimensions are green", () => {
    const r = calcStabilityIndex(makeKPIs(), DEFAULT_THRESHOLDS);
    expect(r.score).toBe(100);
  });

  it("deducts 10 per yellow dimension", () => {
    const r = calcStabilityIndex(
      makeKPIs({ budgetDifferencePct: 20 }), // 1 yellow
      DEFAULT_THRESHOLDS,
    );
    expect(r.score).toBe(90);
  });

  it("deducts 30 per red dimension", () => {
    const r = calcStabilityIndex(
      makeKPIs({ budgetDifferencePct: 30 }), // 1 red
      DEFAULT_THRESHOLDS,
    );
    expect(r.score).toBe(70);
  });

  it("deducts 10 per yellow and 30 per red, combined", () => {
    // budget red (30), schedule yellow (10) → 100 - 30 - 10 = 60
    const r = calcStabilityIndex(
      makeKPIs({ budgetDifferencePct: 30, maxDelayDays: 10 }),
      DEFAULT_THRESHOLDS,
    );
    expect(r.score).toBe(60);
  });

  it("clamps score to 0 when all four dimensions are red", () => {
    const r = calcStabilityIndex(
      makeKPIs({
        budgetDifferencePct: 30,   // > red(25)
        maxDelayDays: 20,          // > red(15)
        overallUtilizationPct: 110, // > red(100)
        scopeGrowthPct: 25,        // > red(20)
      }),
      DEFAULT_THRESHOLDS,
    );
    expect(r.score).toBe(0); // 100 - (4*30) = -20, clamped to 0
  });
});

// ─── Boundary values ─────────────────────────────────────────────────────────

describe("calcStabilityIndex — boundary values", () => {
  it("value equal to yellow threshold is still green (strict >)", () => {
    const r = calcStabilityIndex(
      makeKPIs({ budgetDifferencePct: 15 }), // exactly at yellow threshold
      DEFAULT_THRESHOLDS,
    );
    const budget = r.dimensions.find((d) => d.dimension === "budget")!;
    expect(budget.status).toBe("green");
  });

  it("value one unit above yellow threshold is yellow", () => {
    const r = calcStabilityIndex(
      makeKPIs({ budgetDifferencePct: 15.1 }),
      DEFAULT_THRESHOLDS,
    );
    const budget = r.dimensions.find((d) => d.dimension === "budget")!;
    expect(budget.status).toBe("yellow");
  });

  it("value equal to red threshold is still yellow (strict >)", () => {
    const r = calcStabilityIndex(
      makeKPIs({ budgetDifferencePct: 25 }), // exactly at red threshold
      DEFAULT_THRESHOLDS,
    );
    const budget = r.dimensions.find((d) => d.dimension === "budget")!;
    expect(budget.status).toBe("yellow");
  });

  it("value one unit above red threshold is red", () => {
    const r = calcStabilityIndex(
      makeKPIs({ budgetDifferencePct: 25.1 }),
      DEFAULT_THRESHOLDS,
    );
    const budget = r.dimensions.find((d) => d.dimension === "budget")!;
    expect(budget.status).toBe("red");
  });

  it("schedule: delay exactly at yellow threshold is green", () => {
    const r = calcStabilityIndex(
      makeKPIs({ maxDelayDays: 5 }),
      DEFAULT_THRESHOLDS,
    );
    const sched = r.dimensions.find((d) => d.dimension === "schedule")!;
    expect(sched.status).toBe("green");
  });

  it("resource: utilisation exactly at yellow threshold is green", () => {
    const r = calcStabilityIndex(
      makeKPIs({ overallUtilizationPct: 85 }),
      DEFAULT_THRESHOLDS,
    );
    const res = r.dimensions.find((d) => d.dimension === "resource")!;
    expect(res.status).toBe("green");
  });
});

// ─── Custom thresholds ───────────────────────────────────────────────────────

describe("calcStabilityIndex — custom thresholds", () => {
  it("applies tighter budget thresholds correctly", () => {
    const tight: ProjectThresholds = {
      ...DEFAULT_THRESHOLDS,
      budgetYellowPct: 5,
      budgetRedPct: 10,
    };
    // differencePct=8 → yellow with tight thresholds, green with defaults
    const r = calcStabilityIndex(makeKPIs({ budgetDifferencePct: 8 }), tight);
    const budget = r.dimensions.find((d) => d.dimension === "budget")!;
    expect(budget.status).toBe("yellow");
  });

  it("applies looser schedule thresholds correctly", () => {
    const loose: ProjectThresholds = {
      ...DEFAULT_THRESHOLDS,
      scheduleYellowDays: 30,
      scheduleRedDays: 60,
    };
    // maxDelayDays=10 → green with loose thresholds, yellow with defaults
    const r = calcStabilityIndex(makeKPIs({ maxDelayDays: 10 }), loose);
    const sched = r.dimensions.find((d) => d.dimension === "schedule")!;
    expect(sched.status).toBe("green");
  });
});

// ─── DimensionResult structure ───────────────────────────────────────────────

describe("calcStabilityIndex — DimensionResult shape", () => {
  it("returns exactly four dimensions in order: budget, schedule, resource, scope", () => {
    const r = calcStabilityIndex(makeKPIs(), DEFAULT_THRESHOLDS);
    expect(r.dimensions).toHaveLength(4);
    expect(r.dimensions.map((d) => d.dimension)).toEqual([
      "budget",
      "schedule",
      "resource",
      "scope",
    ]);
  });

  it("each DimensionResult carries the correct value and threshold", () => {
    const r = calcStabilityIndex(
      makeKPIs({ budgetDifferencePct: 20 }),
      DEFAULT_THRESHOLDS,
    );
    const budget = r.dimensions.find((d) => d.dimension === "budget")!;
    expect(budget.value).toBe(20);
    expect(budget.threshold.yellow).toBe(15);
    expect(budget.threshold.red).toBe(25);
  });

  it("negative budget differencePct (under budget) is green", () => {
    const r = calcStabilityIndex(
      makeKPIs({ budgetDifferencePct: -10 }),
      DEFAULT_THRESHOLDS,
    );
    const budget = r.dimensions.find((d) => d.dimension === "budget")!;
    expect(budget.status).toBe("green");
  });
});
