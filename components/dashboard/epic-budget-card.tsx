import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  projectId: string;
  overbooked: number;
  nearLimit: number;
  hasJiraData: boolean;
  searchString: string;
}

function tileStatus(overbooked: number, nearLimit: number): "red" | "yellow" | "green" {
  if (overbooked > 0) return "red";
  if (nearLimit > 0) return "yellow";
  return "green";
}

const borderClass = {
  red: "border-red-300",
  yellow: "border-yellow-300",
  green: "border-green-200",
} as const;

export function EpicBudgetCard({
  projectId,
  overbooked,
  nearLimit,
  hasJiraData,
  searchString,
}: Props) {
  const href = `/projects/${projectId}/epics${searchString ? `?${searchString}` : ""}`;
  const status = tileStatus(overbooked, nearLimit);

  return (
    <Link href={href} className="block">
      <Card
        className={`h-full cursor-pointer transition-colors hover:bg-muted/50 ${hasJiraData ? borderClass[status] : ""}`}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Epic Budget</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasJiraData ? (
            <p className="text-lg font-semibold text-muted-foreground">—</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Overbooked</p>
                <div className="mt-1">
                  {overbooked > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-semibold text-red-800">
                      {overbooked}
                    </span>
                  ) : (
                    <span className="text-lg font-semibold">0</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Near limit</p>
                <div className="mt-1">
                  {nearLimit > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-sm font-semibold text-yellow-800">
                      {nearLimit}
                    </span>
                  ) : (
                    <span className="text-lg font-semibold">0</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
