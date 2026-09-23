import { createAdminSupabaseClient } from "@/core/db/admin";
import type { DomainEvent, EventHandler } from "@/core/modules";

/**
 * Gestionnaires du module remplacements.
 *
 * Le module n'écrit pas dans le planning : il annonce, le planning applique.
 * Ce qui reste ici, c'est prévenir la personne concernée — et c'est la
 * notification la plus utile de toute l'application, parce qu'elle change son
 * lendemain.
 */

function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function notifyEmployee(
  event: DomainEvent,
  type: string,
  context: Parameters<EventHandler>[1],
): Promise<void> {
  const payload = asRecord(event.payload);
  const employeeId = asString(payload.employee_id);
  const boutiqueId = asString(payload.boutique_id);
  if (!employeeId) return;

  const admin = createAdminSupabaseClient();

  const [{ data: employee }, { data: boutique }] = await Promise.all([
    admin.from("employees").select("auth_user_id").eq("id", employeeId).maybeSingle(),
    boutiqueId
      ? admin.from("boutiques").select("name").eq("id", boutiqueId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!employee?.auth_user_id) return;

  await context.notify(employee.auth_user_id, type, {
    ...payload,
    boutique_name: boutique?.name ?? "un autre point de vente",
  });
}

export const remplacementsEventHandlers: Record<string, EventHandler> = {
  "remplacements.created": async (event, context) => {
    await notifyEmployee(event, "remplacements.created", context);
  },

  "remplacements.cancelled": async (event, context) => {
    await notifyEmployee(event, "remplacements.cancelled", context);
  },
};
