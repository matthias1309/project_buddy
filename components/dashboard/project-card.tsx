import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StabilityBadge } from "@/components/shared/stability-badge";
import type { Database } from "@/types/database.types";
import type { StabilityStatus, StabilityDimension } from "@/types/domain.types";

type Project = Database["public"]["Tables"]["projects"]["Row"];

interface ProjectCardProps {
  project: Project;
  lastImportedAt: string | null;
  stabilityStatus: StabilityStatus;
  criticalDimension: StabilityDimension | null;
  hint: string | null;
}

const dimensionLabel: Record<StabilityDimension, string> = {
  budget: "Budget",
  schedule: "Schedule",
  resource: "Resources",
  scope: "Scope",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ProjectCard({
  project,
  lastImportedAt,
  stabilityStatus,
  criticalDimension,
  hint,
}: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}`} className="block group">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">
              {project.name}
            </CardTitle>
            <StabilityBadge status={stabilityStatus} />
          </div>
          {project.project_number && (
            <p className="text-xs text-muted-foreground">
              {project.project_number}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-1 pt-0">
          {criticalDimension && hint && (
            <p className="text-xs font-medium text-muted-foreground">
              {dimensionLabel[criticalDimension]}:{" "}
              <span
                className={
                  stabilityStatus === "red"
                    ? "text-red-600"
                    : "text-yellow-600"
                }
              >
                {hint}
              </span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {lastImportedAt
              ? `Last import: ${formatDate(lastImportedAt)}`
              : "No data imported yet"}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
