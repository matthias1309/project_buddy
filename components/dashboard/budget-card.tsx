import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StabilityBadge } from "@/components/shared/stability-badge";
import type { StabilityStatus } from "@/types/domain.types";

interface BudgetCardProps {
  plannedEur: number;
  actualEur: number;
  differenceEur: number;
  differencePct: number;
  burnRate: number;
  status: StabilityStatus;
}

function eur(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function pct(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} %`;
}

export function BudgetCard({
  plannedEur,
  actualEur,
  differenceEur,
  differencePct,
  burnRate,
  status,
}: BudgetCardProps) {
  const fillPct = plannedEur > 0 ? Math.min((actualEur / plannedEur) * 100, 100) : 0;
  const overBudget = differenceEur > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Budget</CardTitle>
        <StabilityBadge status={status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key numbers */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Plan</p>
            <p className="text-lg font-semibold">{eur(plannedEur)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ist</p>
            <p className="text-lg font-semibold">{eur(actualEur)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Differenz</p>
            <p
              className={`text-lg font-semibold ${overBudget ? "text-red-600" : "text-green-600"}`}
            >
              {eur(differenceEur)}{" "}
              <span className="text-sm font-normal">({pct(differencePct)})</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Burn Rate / Monat</p>
            <p className="text-lg font-semibold">{eur(burnRate)}</p>
          </div>
        </div>

        {/* Progress bar: Ist vs Plan */}
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Ist</span>
            <span>{fillPct.toFixed(0)} %</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${overBudget ? "bg-red-500" : "bg-green-500"}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
