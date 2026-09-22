"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createServerSupabaseClient } from "@/core/db/server";

const schema = z.object({
  email: z.string().email("Adresse email invalide."),
  password: z.string().min(1, "Mot de passe requis."),
});

export interface SignInState {
  error: string | null;
}

/**
 * Direction sign-in.
 *
 * Holding the right password is not enough: the account must also carry the
 * `admin` role. An employee account that somehow knew a password would be signed
 * straight back out rather than landing in the direction space.
 */
export async function signInAdmin(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Identifiants invalides." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Same wording for a wrong address and a wrong password: a login screen
    // should not confirm which accounts exist.
    return { error: "Email ou mot de passe incorrect." };
  }

  const { data: roles } = await supabase.from("user_roles").select("role").eq("role", "admin");

  if (!roles || roles.length === 0) {
    await supabase.auth.signOut();
    return { error: "Ce compte n'a pas accès à l'espace direction." };
  }

  redirect("/admin");
}
