"use server";

import { createClient } from "@/lib/supabase/server";
import {
  ThresholdsSchema,
  DEFAULT_THRESHOLDS,
  type ThresholdsInput,
} from "@/lib/validations/thresholds.schema";
import { ERRORS } from "@/lib/errors";

export type ThresholdActionState = {
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

export async function updateThresholds(
  projectId: string,
  _prevState: ThresholdActionState,
  formData: FormData,
): Promise<ThresholdActionState> {
  const raw: Record<string, FormDataEntryValue | null> = {
    budget_yellow_pct: formData.get("budget_yellow_pct"),
    budget_red_pct: formData.get("budget_red_pct"),
    schedule_yellow_days: formData.get("schedule_yellow_days"),
    schedule_red_days: formData.get("schedule_red_days"),
    resource_yellow_pct: formData.get("resource_yellow_pct"),
    resource_red_pct: formData.get("resource_red_pct"),
    scope_yellow_pct: formData.get("scope_yellow_pct"),
    scope_red_pct: formData.get("scope_red_pct"),
    epic_warning_margin_pct: formData.get("epic_warning_margin_pct"),
  };

  const parsed = ThresholdsSchema.safeParse(raw);
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

  if (!user) return { globalError: ERRORS.AUTH_UNAUTHORIZED };

  const hasAccess = await verifyProjectAccess(supabase, projectId, user.id);
  if (!hasAccess) return { globalError: ERRORS.PROJECT_ACCESS_DENIED };

  const { error } = await supabase
    .from("project_thresholds")
    .update(parsed.data)
    .eq("project_id", projectId);

  if (error) return { globalError: ERRORS.GENERIC };

  return { success: true };
}

export async function resetThresholds(
  projectId: string,
): Promise<{ success: boolean; data?: ThresholdsInput; globalError?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, globalError: ERRORS.AUTH_UNAUTHORIZED };

  const hasAccess = await verifyProjectAccess(supabase, projectId, user.id);
  if (!hasAccess)
    return { success: false, globalError: ERRORS.PROJECT_ACCESS_DENIED };

  const { error } = await supabase
    .from("project_thresholds")
    .update(DEFAULT_THRESHOLDS)
    .eq("project_id", projectId);

  if (error) return { success: false, globalError: ERRORS.GENERIC };

  return { success: true, data: DEFAULT_THRESHOLDS };
}
