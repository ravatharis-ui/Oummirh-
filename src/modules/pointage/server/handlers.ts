import { createAdminSupabaseClient } from "@/core/db/admin";
import type { DomainEvent, EventHandler } from "@/core/modules";

/**
 * Handlers of the pointage module.
 *
 * A late arrival and a forgotten departure concern the direction, not the
 * collaboratrice: telling someone they are late is a conversation, not a push
 * notification. So both are announced to the admins, once per day, and the
 * database's `pointage_alerts` table is what guarantees the "once".
 */

function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : {};
}

async function adminUserIds(): Promise<string[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  return (data ?? []).map((row) => row.user_id);
}

async function displayNameOf(employeeId: string): Promise<string> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("employees")
    .select("display_name")
    .eq("id", employeeId)
    .maybeSingle();

  return data?.display_name ?? "Une collaboratrice";
}

/**
 * Announces to every admin.
 *
 * Notifying each of them in turn rather than the first one found: a shop the
 * direction shares is exactly the case where "someone will have seen it" ends
 * with nobody having seen it.
 */
async function notifyAdmins(
  event: DomainEvent,
  type: string,
  context: Parameters<EventHandler>[1],
): Promise<void> {
  const payload = asRecord(event.payload);
  const employeeId = typeof payload.employee_id === "string" ? payload.employee_id : null;
  if (!employeeId) return;

  const [recipients, displayName] = await Promise.all([adminUserIds(), displayNameOf(employeeId)]);

  for (const recipient of recipients) {
    await context.notify(recipient, type, { ...payload, display_name: displayName });
  }
}

export const pointageEventHandlers: Record<string, EventHandler> = {
  "pointage.late": async (event, context) => {
    await notifyAdmins(event, "pointage.late", context);
  },

  "pointage.missing_clock_out": async (event, context) => {
    await notifyAdmins(event, "pointage.missing_clock_out", context);
  },
};
