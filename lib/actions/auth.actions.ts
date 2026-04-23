"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginSchema } from "@/lib/validations/auth.schema";
import { ERRORS } from "@/lib/errors";

export type AuthActionState = { error: string } | null;

export async function login(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: ERRORS.AUTH_INVALID_CREDENTIALS };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: ERRORS.AUTH_INVALID_CREDENTIALS };
  }

  redirect("/");
}

export async function logout(): Promise<never> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
