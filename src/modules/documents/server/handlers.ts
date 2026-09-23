import { createAdminSupabaseClient } from "@/core/db/admin";
import type { EventHandler } from "@/core/modules";

/**
 * Gestionnaires du module documents.
 *
 * Un seul rôle : prévenir la personne concernée. « Ta fiche de paie de septembre
 * est disponible » est le genre de message qu'on attend, donc il part aussi par
 * email quand elle a une adresse.
 */

function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : {};
}

export const documentsEventHandlers: Record<string, EventHandler> = {
  "documents.added": async (event, context) => {
    const payload = asRecord(event.payload);
    const employeeId = typeof payload.employee_id === "string" ? payload.employee_id : null;
    if (!employeeId) return;

    const admin = createAdminSupabaseClient();
    const { data } = await admin
      .from("employees")
      .select("auth_user_id")
      .eq("id", employeeId)
      .maybeSingle();

    if (!data?.auth_user_id) return;

    await context.notify(data.auth_user_id, "documents.added", payload);
  },
};
