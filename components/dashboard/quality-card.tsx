import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OpenBugsByPriority } from "@/types/domain.types";

interface Props {
  projectId: string;
  openByPriority: OpenBugsByPriority | null;
  searchString: string;
}

const PRIORITY_LABELS: Array<{
  key: keyof OpenBugsByPriority;
  label: string;
  badge: string;
}> = [
  { key: "critical", label: "Critical", badge: "bg-red-100 text-red-800" },
  { key: "major",    label: "Major",    badge: "bg-orange-100 text-orange-800" },
  { key: "minor",    label: "Minor",    badge: "bg-yellow-100 text-yellow-800" },
  { key: "trivial",  label: "Trivial",  badge: "bg-slate-100 text-slate-700" },
];

export function QualityCard({ projectId, openByPriority, searchString }: Props) {
  const href = `/projects/${projectId}/quality${searchString ? `?${searchString}` : ""}`;
  const totalOpen = openByPriority
    ? openByPriority.critical + openByPriority.major + openByPriority.minor + openByPriority.trivial + openByPriority.unknown
    : null;

  return (
    <Link href={href} className="block">
      <Card className="h-full cursor-pointer transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Quality</CardTitle>
        </CardHeader>
        <CardContent>
          {openByPriority === null ? (
            <p className="text-lg font-semibold text-muted-foreground">—</p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-2xl font-bold">{totalOpen}</p>
                <p className="text-xs text-muted-foreground">open bugs</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRIORITY_LABELS.map(({ key, label, badge }) => {
                  const count = openByPriority[key];
                  if (count === 0) return null;
                  return (
                    <span
                      key={key}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}
                    >
                      {label} {count}
                    </span>
                  );
                })}
                {openByPriority.unknown > 0 && (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                    Unknown {openByPriority.unknown}
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
