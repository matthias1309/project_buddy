import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StabilityBadge } from "@/components/shared/stability-badge";
import type { StabilityStatus } from "@/types/domain.types";

interface DelayedMilestone {
  name: string;
  delayDays: number;
}

interface NextMilestone {
  name: string;
  plannedDateStr: string | null;
  delayDays: number;
}

interface StatusBreakdown {
  completed: number;
  delayed: number;
  planned: number;
}

interface ScheduleCardProps {
  totalMilestones: number;
  delayedMilestones: number;
  maxDelayDays: number;
  nextMilestone: NextMilestone | null;
  delayedList: DelayedMilestone[];
  statusBreakdown: StatusBreakdown;
  status: StabilityStatus;
}

export function ScheduleCard({
  totalMilestones,
  nextMilestone,
  delayedList,
  statusBreakdown,
  status,
}: ScheduleCardProps) {
  const { completed, delayed, planned } = statusBreakdown;
  const total = completed + delayed + planned;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Zeitplan</CardTitle>
        <StabilityBadge status={status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Next milestone */}
        {nextMilestone ? (
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Nächster Meilenstein</p>
            <p className="font-medium">{nextMilestone.name}</p>
            <div className="mt-1 flex items-center gap-2 text-xs">
              {nextMilestone.plannedDateStr && (
                <span className="text-muted-foreground">
                  {nextMilestone.plannedDateStr}
                </span>
              )}
              {nextMilestone.delayDays > 0 && (
                <span className="text-red-600 font-medium">
                  {nextMilestone.delayDays} Tage Verzug
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Alle Meilensteine abgeschlossen.
          </p>
        )}

        {/* Milestone status breakdown bar */}
        {totalMilestones > 0 && total > 0 && (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">
              {totalMilestones} Meilensteine gesamt
            </p>
            <div className="flex h-2 w-full overflow-hidden rounded-full">
              {completed > 0 && (
                <div
                  className="bg-green-500"
                  style={{ width: `${(completed / total) * 100}%` }}
                  title={`${completed} abgeschlossen`}
                />
              )}
              {delayed > 0 && (
                <div
                  className="bg-red-500"
                  style={{ width: `${(delayed / total) * 100}%` }}
                  title={`${delayed} verzögert`}
                />
              )}
              {planned > 0 && (
                <div
                  className="bg-muted-foreground/30"
                  style={{ width: `${(planned / total) * 100}%` }}
                  title={`${planned} geplant`}
                />
              )}
            </div>
            <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                {completed} fertig
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                {delayed} verzögert
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                {planned} offen
              </span>
            </div>
          </div>
        )}

        {/* Delayed milestone list */}
        {delayedList.length > 0 && (
          <ul className="space-y-1">
            {delayedList.map((m) => (
              <li
                key={m.name}
                className="flex items-center justify-between text-sm"
              >
                <span className="truncate text-muted-foreground">{m.name}</span>
                <span className="ml-2 shrink-0 text-red-600 text-xs font-medium">
                  +{m.delayDays} Tage
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
