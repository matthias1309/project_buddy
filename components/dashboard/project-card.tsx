"use client";

import { useRouter } from "next/navigation";
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
  monthlyHours: number | null;
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

function formatMonth(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function ProjectCard({
  project,
  lastImportedAt,
  stabilityStatus,
  criticalDimension,
  hint,
  monthlyHours,
}: ProjectCardProps) {
  const router = useRouter();

  return (
    <Card
      className="h-full cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => router.push(`/projects/${project.id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{project.name}</CardTitle>
          <StabilityBadge status={stabilityStatus} />
        </div>
        {project.project_number && (
          <p className="text-xs text-muted-foreground">{project.project_number}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {criticalDimension && hint && (
          <p className="text-xs font-medium text-muted-foreground">
            {dimensionLabel[criticalDimension]}:{" "}
            <span className={stabilityStatus === "red" ? "text-red-600" : "text-yellow-600"}>
              {hint}
            </span>
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {lastImportedAt
            ? `Last import: ${formatDate(lastImportedAt)}`
            : "No data imported yet"}
        </p>
        <div
          className="flex items-center justify-between rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/projects/${project.id}/time`);
          }}
        >
          <span>
            Time · {formatMonth(new Date())}
          </span>
          <span className="font-medium">
            {monthlyHours !== null ? `${monthlyHours % 1 === 0 ? monthlyHours : monthlyHours.toFixed(1)} h` : "—"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
