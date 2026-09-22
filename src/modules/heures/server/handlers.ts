import { createAdminSupabaseClient } from "@/core/db/admin";
import type { DomainEvent, EventHandler } from "@/core/modules";

/**
 * Gestionnaires du module heures.
 *
 * Deux rôles. D'abord recalculer : une journée close, ou corrigée, change
 * l'écart entre le réel et le planifié, et `compute_daily_hours` est idempotente
 * — la rejouer met la journée à jour au lieu de la compter deux fois.
 *
 * Ensuite notifier : une demande de récupération va à la direction, une décision
 * revient à la collaboratrice.
 */

function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function recompute(event: DomainEvent): Promise<void> {
  const payload = asRecord(event.payload);
  const localDate = asString(payload.local_date);
  if (!localDate) return;

  const admin = createAdminSupabaseClient();
  const { error } = await admin.rpc("compute_daily_hours", { p_date: localDate });

  if (error) {
    throw new Error(`Recalcul des heures impossible : ${error.message}`);
  }
}

async function adminUserIds(): Promise<string[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  return (data ?? []).map((row) => row.user_id);
}

async function employeeIdentity(
  employeeId: string,
): Promise<{ userId: string | null; displayName: string }> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("employees")
    .select("auth_user_id, display_name")
    .eq("id", employeeId)
    .maybeSingle();

  return {
    userId: data?.auth_user_id ?? null,
    displayName: data?.display_name ?? "Une collaboratrice",
  };
}

export const heuresEventHandlers: Record<string, EventHandler> = {
  /**
   * Un départ pointé ferme la journée : c'est le seul moment où l'écart devient
   * calculable. Les autres pointages ne changent rien au total.
   */
  "pointage.clock_recorded": async (event) => {
    const payload = asRecord(event.payload);
    if (payload.event_type !== "clock_out") return;
    await recompute(event);
  },

  "pointage.corrected": async (event) => {
    await recompute(event);
  },

  "heures.recovery_requested": async (event, context) => {
    const payload = asRecord(event.payload);
    const employeeId = asString(payload.employee_id);
    if (!employeeId) return;

    const [recipients, { displayName }] = await Promise.all([
      adminUserIds(),
      employeeIdentity(employeeId),
    ]);

    for (const recipient of recipients) {
      await context.notify(recipient, "heures.recovery_requested", {
        ...payload,
        display_name: displayName,
      });
    }
  },

  "heures.recovery_approved": async (event, context) => {
    const payload = asRecord(event.payload);
    const employeeId = asString(payload.employee_id);
    if (!employeeId) return;

    const { userId, displayName } = await employeeIdentity(employeeId);
    if (!userId) return;

    await context.notify(userId, "heures.recovery_approved", {
      ...payload,
      display_name: displayName,
    });
  },

  "heures.recovery_refused": async (event, context) => {
    const payload = asRecord(event.payload);
    const employeeId = asString(payload.employee_id);
    if (!employeeId) return;

    const { userId, displayName } = await employeeIdentity(employeeId);
    if (!userId) return;

    await context.notify(userId, "heures.recovery_refused", {
      ...payload,
      display_name: displayName,
    });
  },
};
