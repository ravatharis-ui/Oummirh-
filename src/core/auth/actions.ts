"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/core/db/server";

/** Ends the session and returns to the right login screen. */
export async function signOut(space: "collab" | "admin" = "collab"): Promise<never> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect(space === "admin" ? "/admin/connexion" : "/connexion");
}
