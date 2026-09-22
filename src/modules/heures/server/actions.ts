"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin, requireEmployee } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";

import {
  hoursAdjustmentSchema,
  recoveryDecisionSchema,
  recoveryRequestSchema,
  type HoursAdjustmentInput,
  type RecoveryRequestInput,
} from "../schemas";
import type { ActionResult } from "../types";

const COLLAB_PATH = "/heures";
const ADMIN_PATH = "/admin/heures";

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Données invalides.";
}

function toFrenchError(message: string, fallback: string): string {
  return /[éèêàùûîôç]/i.test(message) ? message : fallback;
}

function revalidateAll(): void {
  revalidatePath(COLLAB_PATH);
  revalidatePath(ADMIN_PATH);
  revalidatePath("/admin/planning");
  revalidatePath("/planning");
}

export async function requestRecovery(
  input: RecoveryRequestInput,
): Promise<ActionResult<{ id: string }>> {
  await requireEmployee();

  const parsed = recoveryRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("request_recovery", {
    p_date: parsed.data.date,
    p_mode: parsed.data.mode,
    p_minutes: parsed.data.minutes,
  });

  if (error) {
    console.error("[heures] Demande refusée", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "La demande n'a pas pu être envoyée. Réessaie."),
    };
  }

  revalidateAll();
  return { ok: true, data: { id: data } };
}

/**
 * Valider ou refuser, en un clic.
 *
 * La base écrit le débit ; le déplacement de la journée est l'affaire du module
 * planning, qui écoute `heures.recovery_approved`. Cette action ne touche donc
 * jamais à `planning_entries`.
 */
export async function decideRecovery(
  requestId: string,
  approve: boolean,
  comment?: string | null,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = recoveryDecisionSchema.safeParse({ requestId, approve, comment });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("admin_decide_recovery", {
    p_request_id: parsed.data.requestId,
    p_approve: parsed.data.approve,
    ...(parsed.data.comment ? { p_comment: parsed.data.comment } : {}),
  });

  if (error) {
    console.error("[heures] Décision impossible", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "La décision n'a pas pu être enregistrée. Réessayez."),
    };
  }

  revalidateAll();
  return { ok: true, data: undefined };
}

export async function adjustHoursBalance(input: HoursAdjustmentInput): Promise<ActionResult> {
  await requireAdmin();

  const parsed = hoursAdjustmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("admin_adjust_hours", {
    p_employee_id: parsed.data.employeeId,
    p_minutes: parsed.data.minutes,
    p_note: parsed.data.note,
  });

  if (error) {
    console.error("[heures] Ajustement impossible", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "L'ajustement n'a pas pu être enregistré."),
    };
  }

  revalidateAll();
  return { ok: true, data: undefined };
}
