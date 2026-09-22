"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin, requireEmployee } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";

import { isClockEventType, type ClockEventType } from "../domain/sequence";
import { clockEventSchema, correctionSchema, type CorrectionInput } from "../schemas";
import type { ActionResult, ClockRecord } from "../types";

const COLLAB_PATH = "/pointer";
const ADMIN_PATH = "/admin/pointage";

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Données invalides.";
}

/**
 * Records a pointing.
 *
 * The time is not a parameter and never will be. `clock_event` stamps the row
 * with the server clock, re-checks the sequence and the selfie, and returns the
 * row it wrote — which is what the confirmation screen shows. A phone whose
 * clock is twenty minutes fast cannot make anyone punctual.
 */
export async function recordClock(
  eventType: ClockEventType,
  photoPath?: string | null,
): Promise<ActionResult<{ record: ClockRecord }>> {
  await requireEmployee();

  const parsed = clockEventSchema.safeParse({ eventType, photoPath: photoPath ?? null });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("clock_event", {
    p_event_type: parsed.data.eventType,
    ...(parsed.data.photoPath ? { p_photo_path: parsed.data.photoPath } : {}),
  });

  if (error) {
    console.error("[pointage] Pointage refusé", error.message);
    // The refusals raised by `clock_event` are written for her, in French, and
    // say what to do next. Replacing them with a generic sentence would take
    // away the only useful part.
    return {
      ok: false,
      error: /[éèêàùûîôç]/i.test(error.message)
        ? error.message
        : "Le pointage n'a pas pu être enregistré. Réessaie dans un instant.",
    };
  }

  if (!data || !isClockEventType(data.event_type)) {
    return { ok: false, error: "Le pointage n'a pas pu être enregistré. Réessaie." };
  }

  revalidatePath(COLLAB_PATH);
  revalidatePath(ADMIN_PATH);

  return {
    ok: true,
    data: {
      record: {
        id: data.id,
        employeeId: data.employee_id,
        eventType: data.event_type,
        occurredAt: data.occurred_at,
        localDate: data.local_date,
        plannedTime: data.planned_time,
        deltaMinutes: data.delta_minutes,
        isCorrection: data.is_correction,
        correctionReason: data.correction_reason,
        photoPath: data.photo_path,
      },
    },
  };
}

/**
 * Corrects a pointing.
 *
 * Nothing is rewritten: a corrected row is added, it carries its reason and its
 * author, and the original stays readable. The consolidated views show the last
 * word, the table keeps the whole conversation.
 */
export async function correctClock(input: CorrectionInput): Promise<ActionResult> {
  await requireAdmin();

  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const value = parsed.data;
  const supabase = await createServerSupabaseClient();

  // The direction types a local time; Réunion is UTC+4 all year, with no
  // daylight saving, so the instant is unambiguous.
  const occurredAt = `${value.localDate}T${value.time}:00+04:00`;

  const { error } = await supabase.rpc("admin_correct_time_clock", {
    p_employee_id: value.employeeId,
    p_local_date: value.localDate,
    p_event_type: value.eventType,
    p_occurred_at: occurredAt,
    p_reason: value.reason,
  });

  if (error) {
    console.error("[pointage] Correction impossible", error.message);
    return { ok: false, error: "Impossible d'enregistrer la correction. Réessayez." };
  }

  revalidatePath(ADMIN_PATH);
  revalidatePath(`${ADMIN_PATH}/historique`);
  return { ok: true, data: undefined };
}
