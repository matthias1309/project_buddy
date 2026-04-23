"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateProjectSchema } from "@/lib/validations/project.schema";
import { ERRORS } from "@/lib/errors";

export type ProjectActionState = {
  errors?: Partial<Record<string, string>>;
  globalError?: string;
} | null;

export async function createProject(
  _prevState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const raw = {
    name: formData.get("name"),
    project_number: formData.get("project_number"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    total_budget_eur: formData.get("total_budget_eur"),
    description: formData.get("description") || undefined,
    client: formData.get("client") || undefined,
  };

  const parsed = CreateProjectSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "global");
      errors[key] = issue.message;
    }
    return { errors };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { globalError: ERRORS.AUTH_UNAUTHORIZED };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      ...parsed.data,
      owner_id: user.id,
      description: parsed.data.description ?? null,
      client: parsed.data.client ?? null,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    return { globalError: ERRORS.GENERIC };
  }

  await supabase.from("project_thresholds").insert({
    project_id: project.id,
    budget_yellow_pct: 15,
    budget_red_pct: 25,
    schedule_yellow_days: 5,
    schedule_red_days: 15,
    resource_yellow_pct: 85,
    resource_red_pct: 100,
    scope_yellow_pct: 10,
    scope_red_pct: 20,
  });

  redirect(`/projects/${project.id}/import`);
}
