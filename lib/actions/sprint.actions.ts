"use server";

import { createClient } from "@/lib/supabase/server";
import { SprintSchema, type SprintInput } from "@/lib/validations/sprint.schema";
import { ERRORS } from "@/lib/errors";

export type SprintActionState = {
  success?: boolean;
  errors?: Partial<Record<string, string>>;
  globalError?: string;
} | null;

async function verifyProjectAccess(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .single();
  return !!data;
}

function parseFormData(formData: FormData): SprintInput | { errors: Record<string, string> } {
  const raw = {
    name:       formData.get("name"),
    start_date: formData.get("start_date"),
    end_date:   formData.get("end_date"),
  };

  const parsed = SprintSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "global");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { errors };
  }
  return parsed.data;
}

export async function createSprint(
  projectId: string,
  _prevState: SprintActionState,
  formData: FormData,
): Promise<SprintActionState> {
  const parseResult = parseFormData(formData);
  if ("errors" in parseResult) return { errors: parseResult.errors };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { globalError: ERRORS.AUTH_UNAUTHORIZED };

  const hasAccess = await verifyProjectAccess(supabase, projectId, user.id);
  if (!hasAccess) return { globalError: ERRORS.PROJECT_ACCESS_DENIED };

  const { error } = await supabase.from("project_sprints").insert({
    project_id: projectId,
    ...parseResult,
  });

  if (error) return { globalError: ERRORS.GENERIC };
  return { success: true };
}

export async function updateSprint(
  projectId: string,
  sprintId: string,
  _prevState: SprintActionState,
  formData: FormData,
): Promise<SprintActionState> {
  const parseResult = parseFormData(formData);
  if ("errors" in parseResult) return { errors: parseResult.errors };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { globalError: ERRORS.AUTH_UNAUTHORIZED };

  const hasAccess = await verifyProjectAccess(supabase, projectId, user.id);
  if (!hasAccess) return { globalError: ERRORS.PROJECT_ACCESS_DENIED };

  const { error, count } = await supabase
    .from("project_sprints")
    .update(parseResult)
    .eq("id", sprintId)
    .eq("project_id", projectId);

  if (error) return { globalError: ERRORS.GENERIC };
  if (count === 0) return { globalError: ERRORS.SPRINT_NOT_FOUND };
  return { success: true };
}

export async function deleteSprint(
  projectId: string,
  sprintId: string,
): Promise<{ success: boolean; globalError?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, globalError: ERRORS.AUTH_UNAUTHORIZED };

  const hasAccess = await verifyProjectAccess(supabase, projectId, user.id);
  if (!hasAccess) return { success: false, globalError: ERRORS.PROJECT_ACCESS_DENIED };

  const { error } = await supabase
    .from("project_sprints")
    .delete()
    .eq("id", sprintId)
    .eq("project_id", projectId);

  if (error) return { success: false, globalError: ERRORS.GENERIC };
  return { success: true };
}
