"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin, requireEmployee } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";

import {
  leaveAdjustmentSchema,
  leaveDecisionSchema,
  leaveRequestSchema,
  type LeaveAdjustmentInput,
  type LeaveRequestInput,
} from "../schemas";
import type { ActionResult } from "../types";

const COLLAB_PATH = "/conges";
const ADMIN_PATH = "/admin/conges";

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Données invalides.";
}

/**
 * Les refus écrits dans les fonctions SQL sont rédigés en français, pour la
 * personne qui les lit. Les laisser passer vaut mieux que les remplacer par une
 * phrase générique qui cacherait la règle enfreinte.
 */
function toFrenchError(message: string, fallback: string): string {
  return /[éèêàùûîôç]/i.test(message) ? message : fallback;
}

function revalidateAll(): void {
  revalidatePath(COLLAB_PATH);
  revalidatePath(ADMIN_PATH);
  revalidatePath("/admin/planning");
  revalidatePath("/planning");
}

export async function submitLeaveRequest(
  input: LeaveRequestInput,
): Promise<ActionResult<{ id: string }>> {
  await requireEmployee();

  const parsed = leaveRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const value = parsed.data;
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("request_leave", {
    p_start_date: value.startDate,
    p_end_date: value.endDate,
    ...(value.startHalf ? { p_start_half: value.startHalf } : {}),
    ...(value.endHalf ? { p_end_half: value.endHalf } : {}),
    ...(value.reason ? { p_reason: value.reason } : {}),
    ...(value.justificationPath ? { p_justification_path: value.justificationPath } : {}),
  });

  if (error) {
    console.error("[conges] Demande refusée", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "La demande n'a pas pu être envoyée. Réessaie."),
    };
  }

  revalidateAll();
  return { ok: true, data: { id: data } };
}

/**
 * Valider ou refuser.
 *
 * Le décompte est recalculé par la base au moment de la décision : entre la
 * demande et aujourd'hui, le planning a pu changer.
 */
export async function decideLeaveRequest(
  requestId: string,
  approve: boolean,
  comment?: string | null,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = leaveDecisionSchema.safeParse({ requestId, approve, comment });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("admin_decide_leave", {
    p_request_id: parsed.data.requestId,
    p_approve: parsed.data.approve,
    ...(parsed.data.comment ? { p_comment: parsed.data.comment } : {}),
  });

  if (error) {
    console.error("[conges] Décision impossible", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "La décision n'a pas pu être enregistrée. Réessayez."),
    };
  }

  revalidateAll();
  return { ok: true, data: undefined };
}

/** Annuler. La base décide qui a le droit, selon le statut de la demande. */
export async function cancelLeaveRequest(requestId: string): Promise<ActionResult> {
  await requireEmployee();

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("cancel_leave_request", { p_request_id: requestId });

  if (error) {
    console.error("[conges] Annulation impossible", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "L'annulation n'a pas pu être enregistrée."),
    };
  }

  revalidateAll();
  return { ok: true, data: undefined };
}

export async function adjustLeaveBalance(input: LeaveAdjustmentInput): Promise<ActionResult> {
  await requireAdmin();

  const parsed = leaveAdjustmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("admin_adjust_leave", {
    p_employee_id: parsed.data.employeeId,
    p_days: parsed.data.days,
    p_note: parsed.data.note,
  });

  if (error) {
    console.error("[conges] Ajustement impossible", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "L'ajustement n'a pas pu être enregistré."),
    };
  }

  revalidateAll();
  return { ok: true, data: undefined };
}
