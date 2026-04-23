import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StabilityBadge } from "@/components/shared/stability-badge";
import type { Database } from "@/types/database.types";

type Project = Database["public"]["Tables"]["projects"]["Row"];

interface ProjectCardProps {
  project: Project;
  lastImportedAt: string | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ProjectCard({ project, lastImportedAt }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}`} className="block group">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">
              {project.name}
            </CardTitle>
            <StabilityBadge status="green" />
          </div>
          {project.project_number && (
            <p className="text-xs text-muted-foreground">
              {project.project_number}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
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
