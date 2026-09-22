import { createAdminSupabaseClient } from "@/core/db/admin";
import type { DomainEvent, EventHandler } from "@/core/modules";

/**
 * Gestionnaires du module congés.
 *
 * Le module ne pose pas lui-même les journées dans le planning : il annonce sa
 * décision, et le planning en tire les conséquences. Ce qui reste ici, ce sont
 * les notifications — qui prévenir, et de quoi.
 */

function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
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

/** Prévenir la collaboratrice concernée, en enrichissant la charge utile de son nom. */
async function notifyOwner(
  event: DomainEvent,
  type: string,
  context: Parameters<EventHandler>[1],
): Promise<void> {
  const payload = asRecord(event.payload);
  const employeeId = asString(payload.employee_id);
  if (!employeeId) return;

  const { userId, displayName } = await employeeIdentity(employeeId);
  if (!userId) return;

  await context.notify(userId, type, { ...payload, display_name: displayName });
}

export const congesEventHandlers: Record<string, EventHandler> = {
  /** Une demande arrive : c'est la direction qui doit la voir. */
  "conges.request_submitted": async (event, context) => {
    const payload = asRecord(event.payload);
    const employeeId = asString(payload.employee_id);
    if (!employeeId) return;

    const [recipients, { displayName }] = await Promise.all([
      adminUserIds(),
      employeeIdentity(employeeId),
    ]);

    for (const recipient of recipients) {
      await context.notify(recipient, "conges.request_submitted", {
        ...payload,
        display_name: displayName,
      });
    }
  },

  "conges.request_approved": async (event, context) => {
    await notifyOwner(event, "conges.request_approved", context);
  },

  "conges.request_refused": async (event, context) => {
    await notifyOwner(event, "conges.request_refused", context);
  },

  /**
   * Une annulation ne se notifie que si elle vient de la direction. S'annuler
   * soi-même une demande en attente et recevoir une notification pour se
   * l'apprendre n'aiderait personne.
   */
  "conges.request_cancelled": async (event, context) => {
    const payload = asRecord(event.payload);
    if (payload.was_approved !== true) return;
    await notifyOwner(event, "conges.request_cancelled", context);
  },
};
