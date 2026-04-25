import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  projectId: string;
  lastImportDate: string | null;
  currentMonthHours: number | null;
}

function fmtH(n: number): string {
  return `${n % 1 === 0 ? n : n.toFixed(1)} h`;
}

export function TimeAnalysisCard({ projectId, lastImportDate, currentMonthHours }: Props) {
  return (
    <Link href={`/projects/${projectId}/time`} className="block">
      <Card className="h-full cursor-pointer transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Time Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Last import</p>
              <p className="text-lg font-semibold">{lastImportDate ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">This month</p>
              <p className="text-lg font-semibold">
                {currentMonthHours === null ? "—" : fmtH(currentMonthHours)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
