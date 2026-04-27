import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ThresholdsForm } from "@/components/dashboard/thresholds-form";
import { SprintManager } from "@/components/dashboard/sprint-manager";
import type { ThresholdsInput } from "@/lib/validations/thresholds.schema";
import { DEFAULT_THRESHOLDS } from "@/lib/validations/thresholds.schema";
import type { ProjectSprint } from "@/types/domain.types";
import { Button } from "@/components/ui/button";

interface Props {
  params: { id: string };
}

export default async function SettingsPage({ params }: Props) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: project }, { data: rawThresholds }, { data: rawSprints }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, name, project_number")
        .eq("id", params.id)
        .eq("owner_id", user.id)
        .single(),
      supabase
        .from("project_thresholds")
        .select("*")
        .eq("project_id", params.id)
        .single(),
      supabase
        .from("project_sprints")
        .select("*")
        .eq("project_id", params.id)
        .order("start_date", { ascending: true }),
    ]);

  if (!project) redirect("/");

  const initialValues: ThresholdsInput = rawThresholds
    ? {
        budget_yellow_pct: rawThresholds.budget_yellow_pct,
        budget_red_pct: rawThresholds.budget_red_pct,
        schedule_yellow_days: rawThresholds.schedule_yellow_days,
        schedule_red_days: rawThresholds.schedule_red_days,
        resource_yellow_pct: rawThresholds.resource_yellow_pct,
        resource_red_pct: rawThresholds.resource_red_pct,
        scope_yellow_pct: rawThresholds.scope_yellow_pct,
        scope_red_pct: rawThresholds.scope_red_pct,
      }
    : DEFAULT_THRESHOLDS;

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {project.project_number ?? params.id}
          </p>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Threshold configuration — traffic-light thresholds for KPI
            indicators
          </p>
        </div>
        <Link href={`/projects/${params.id}`}>
          <Button variant="outline" size="sm">
            Back to dashboard
          </Button>
        </Link>
      </div>

      <ThresholdsForm projectId={params.id} initialValues={initialValues} />

      <SprintManager
        projectId={params.id}
        initialSprints={(rawSprints ?? []) as ProjectSprint[]}
      />
    </main>
  );
}
