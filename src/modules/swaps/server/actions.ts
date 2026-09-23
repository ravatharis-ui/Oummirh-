"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin, requireEmployee } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";

import { swapDecisionSchema, swapRequestSchema, type SwapRequestInput } from "../schemas";
import type { ActionResult } from "../types";

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Données invalides.";
}

function toFrenchError(message: string, fallback: string): string {
  return /[éèêàùûîôç]/i.test(message) ? message : fallback;
}

function revalidateAll(): void {
  revalidatePath("/echanges");
  revalidatePath("/admin/echanges");
  revalidatePath("/planning");
  revalidatePath("/admin/planning");
}

export async function requestSwap(input: SwapRequestInput): Promise<ActionResult<{ id: string }>> {
  await requireEmployee();

  const parsed = swapRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const value = parsed.data;
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("request_swap", {
    p_partner_id: value.partnerId,
    p_requester_date: value.requesterDate,
    p_partner_date: value.partnerDate,
    ...(value.message ? { p_message: value.message } : {}),
  });

  if (error) {
    console.error("[swaps] Demande refusée", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "La demande n'a pas pu être envoyée. Réessaie."),
    };
  }

  revalidateAll();
  return { ok: true, data: { id: data } };
}

/** La collègue répond. La base vérifie que c'est bien elle. */
export async function answerSwap(swapId: string, accept: boolean): Promise<ActionResult> {
  await requireEmployee();

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("partner_decide_swap", {
    p_swap_id: swapId,
    p_accept: accept,
  });

  if (error) {
    console.error("[swaps] Réponse impossible", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "Ta réponse n'a pas pu être enregistrée. Réessaie."),
    };
  }

  revalidateAll();
  return { ok: true, data: undefined };
}

/**
 * La direction tranche.
 *
 * À la validation, le planning des deux change — et c'est le module planning qui
 * s'en charge, en écoutant `swaps.approved`. Cette action n'y touche jamais.
 */
export async function decideSwap(
  swapId: string,
  approve: boolean,
  comment?: string | null,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = swapDecisionSchema.safeParse({ swapId, approve, comment });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("admin_decide_swap", {
    p_swap_id: parsed.data.swapId,
    p_approve: parsed.data.approve,
    ...(parsed.data.comment ? { p_comment: parsed.data.comment } : {}),
  });

  if (error) {
    console.error("[swaps] Décision impossible", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "La décision n'a pas pu être enregistrée. Réessayez."),
    };
  }

  revalidateAll();
  return { ok: true, data: undefined };
}

export async function cancelSwap(swapId: string): Promise<ActionResult> {
  await requireEmployee();

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("cancel_swap", { p_swap_id: swapId });

  if (error) {
    console.error("[swaps] Annulation impossible", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "L'annulation n'a pas pu être enregistrée."),
    };
  }

  revalidateAll();
  return { ok: true, data: undefined };
}
