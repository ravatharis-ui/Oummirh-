"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";

import { replacementSchema, type ReplacementInput } from "../schemas";
import type { ActionResult } from "../types";

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Données invalides.";
}

function toFrenchError(message: string, fallback: string): string {
  return /[éèêàùûîôç]/i.test(message) ? message : fallback;
}

function revalidateAll(): void {
  revalidatePath("/admin/remplacements");
  revalidatePath("/admin/planning");
  revalidatePath("/planning");
  revalidatePath("/accueil");
}

export async function createReplacement(
  input: ReplacementInput,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = replacementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const value = parsed.data;
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("admin_create_replacement", {
    p_employee_id: value.employeeId,
    p_boutique_id: value.boutiqueId,
    p_date: value.date,
    p_start_time: value.startTime,
    p_end_time: value.endTime,
    ...(value.breakStart ? { p_break_start: value.breakStart } : {}),
    ...(value.breakEnd ? { p_break_end: value.breakEnd } : {}),
    ...(value.note ? { p_note: value.note } : {}),
  });

  if (error) {
    console.error("[remplacements] Création impossible", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "Le remplacement n'a pas pu être enregistré."),
    };
  }

  revalidateAll();
  return { ok: true, data: { id: data } };
}

/**
 * Annuler.
 *
 * Le planning rend alors à la journée ce qu'elle contenait avant — c'est le rôle
 * de `clear_planning_from_event`, qui restaure depuis le cliché pris à la pose.
 */
export async function cancelReplacement(id: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("admin_cancel_replacement", { p_id: id });

  if (error) {
    console.error("[remplacements] Annulation impossible", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "Le remplacement n'a pas pu être annulé."),
    };
  }

  revalidateAll();
  return { ok: true, data: undefined };
}
