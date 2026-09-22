"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";

import {
  applyTemplateSchema,
  duplicateWeekSchema,
  planningDaySchema,
  planningEntrySchema,
  type PlanningEntryInput,
} from "../schemas";
import type { ActionResult } from "../types";

const ADMIN_PATH = "/admin/planning";
const COLLAB_PATH = "/planning";

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Données invalides.";
}

/**
 * A refusal from the database carries a message written for the direction, in
 * French. Passing it through beats replacing it with a generic sentence that
 * hides which rule was broken — as long as it is a rule we raised ourselves.
 */
function toFrenchError(message: string, fallback: string): string {
  return /[éèêàùûîôç]/i.test(message) ? message : fallback;
}

function revalidateWeek(): void {
  revalidatePath(ADMIN_PATH);
  revalidatePath(`${ADMIN_PATH}/impression`);
  revalidatePath(COLLAB_PATH);
}

export async function savePlanningEntry(input: PlanningEntryInput): Promise<ActionResult> {
  await requireAdmin();

  const parsed = planningEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const value = parsed.data;
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.rpc("admin_upsert_planning_entry", {
    p_employee_id: value.employeeId,
    p_date: value.date,
    p_status: value.status,
    ...(value.startTime ? { p_start_time: value.startTime } : {}),
    ...(value.endTime ? { p_end_time: value.endTime } : {}),
    ...(value.breakStart ? { p_break_start: value.breakStart } : {}),
    ...(value.breakEnd ? { p_break_end: value.breakEnd } : {}),
    ...(value.boutiqueId ? { p_boutique_id: value.boutiqueId } : {}),
    ...(value.note ? { p_note: value.note } : {}),
  });

  if (error) {
    console.error("[planning] Enregistrement impossible", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "Impossible d'enregistrer cette journée. Réessayez."),
    };
  }

  revalidateWeek();
  return { ok: true, data: undefined };
}

/** Empties a day. The row is removed; nothing about the collaboratrice is. */
export async function clearPlanningEntry(employeeId: string, date: string): Promise<ActionResult> {
  await requireAdmin();

  const parsed = planningDaySchema.safeParse({ employeeId, date });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("admin_delete_planning_entry", {
    p_employee_id: parsed.data.employeeId,
    p_date: parsed.data.date,
  });

  if (error) {
    console.error("[planning] Suppression impossible", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "Impossible de vider cette journée. Réessayez."),
    };
  }

  revalidateWeek();
  return { ok: true, data: undefined };
}

/**
 * Copies a week onto another.
 *
 * What it refuses to touch is the point: an approved leave, a replacement or a
 * swap on the target week keeps its day. The count returned is what actually
 * changed, so the confirmation message can be honest.
 */
export async function duplicateWeek(
  sourceMonday: string,
  targetMonday: string,
  employeeIds?: string[] | null,
): Promise<ActionResult<{ copied: number }>> {
  await requireAdmin();

  const parsed = duplicateWeekSchema.safeParse({ sourceMonday, targetMonday, employeeIds });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("admin_duplicate_planning_week", {
    p_source_monday: parsed.data.sourceMonday,
    p_target_monday: parsed.data.targetMonday,
    ...(parsed.data.employeeIds?.length ? { p_employee_ids: parsed.data.employeeIds } : {}),
  });

  if (error) {
    console.error("[planning] Duplication impossible", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "Impossible de dupliquer cette semaine. Réessayez."),
    };
  }

  revalidateWeek();
  return { ok: true, data: { copied: data ?? 0 } };
}

export async function applyTemplate(
  employeeId: string,
  weekStart: string,
  overwrite = false,
): Promise<ActionResult<{ applied: number }>> {
  await requireAdmin();

  const parsed = applyTemplateSchema.safeParse({ employeeId, weekStart, overwrite });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("admin_apply_planning_template", {
    p_employee_id: parsed.data.employeeId,
    p_week_start: parsed.data.weekStart,
    p_overwrite: parsed.data.overwrite,
  });

  if (error) {
    console.error("[planning] Semaine type impossible", error.message);
    return {
      ok: false,
      error: toFrenchError(error.message, "Impossible d'appliquer la semaine type. Réessayez."),
    };
  }

  revalidateWeek();
  return { ok: true, data: { applied: data ?? 0 } };
}
