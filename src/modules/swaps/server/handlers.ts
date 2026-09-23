import { createAdminSupabaseClient } from "@/core/db/admin";
import type { DomainEvent, EventHandler } from "@/core/modules";

/**
 * Gestionnaires du module échanges.
 *
 * Un échange concerne trois personnes à des moments différents : la collègue
 * quand on lui demande, la demandeuse quand on lui répond, la direction quand
 * il faut trancher. Chaque événement ne prévient que celle dont c'est le tour.
 */

function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function identity(employeeId: string): Promise<{ userId: string | null; name: string }> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("employees")
    .select("auth_user_id, display_name")
    .eq("id", employeeId)
    .maybeSingle();

  return { userId: data?.auth_user_id ?? null, name: data?.display_name ?? "Une collègue" };
}

async function adminUserIds(): Promise<string[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  return (data ?? []).map((row) => row.user_id);
}

/** Prévenir une des deux parties, en nommant l'autre dans la charge utile. */
async function notifyOne(
  event: DomainEvent,
  type: string,
  who: "requester" | "partner",
  context: Parameters<EventHandler>[1],
): Promise<void> {
  const payload = asRecord(event.payload);
  const target = asString(payload[`${who}_id`]);
  const other = asString(payload[who === "requester" ? "partner_id" : "requester_id"]);
  if (!target) return;

  const [me, them] = await Promise.all([
    identity(target),
    other ? identity(other) : Promise.resolve({ userId: null, name: "une collègue" }),
  ]);

  if (!me.userId) return;

  await context.notify(me.userId, type, { ...payload, other_name: them.name });
}

export const swapsEventHandlers: Record<string, EventHandler> = {
  /** On demande quelque chose à la collègue : c'est à elle de le savoir. */
  "swaps.requested": async (event, context) => {
    await notifyOne(event, "swaps.requested", "partner", context);
  },

  "swaps.accepted_by_partner": async (event, context) => {
    const payload = asRecord(event.payload);

    // La demandeuse apprend que sa collègue est d'accord…
    await notifyOne(event, "swaps.accepted_by_partner", "requester", context);

    // …et la direction, qu'il y a quelque chose à valider.
    const requesterId = asString(payload.requester_id);
    const partnerId = asString(payload.partner_id);
    if (!requesterId || !partnerId) return;

    const [recipients, requester, partner] = await Promise.all([
      adminUserIds(),
      identity(requesterId),
      identity(partnerId),
    ]);

    for (const recipient of recipients) {
      await context.notify(recipient, "swaps.pending_admin", {
        ...payload,
        requester_name: requester.name,
        partner_name: partner.name,
      });
    }
  },

  "swaps.refused_by_partner": async (event, context) => {
    await notifyOne(event, "swaps.refused_by_partner", "requester", context);
  },

  /** Validé : les deux sont concernées, et leur planning a changé. */
  "swaps.approved": async (event, context) => {
    await notifyOne(event, "swaps.approved", "requester", context);
    await notifyOne(event, "swaps.approved", "partner", context);
  },

  "swaps.refused_by_admin": async (event, context) => {
    await notifyOne(event, "swaps.refused_by_admin", "requester", context);
    await notifyOne(event, "swaps.refused_by_admin", "partner", context);
  },

  /** Une annulation ne concerne que la collègue à qui on avait demandé. */
  "swaps.cancelled": async (event, context) => {
    await notifyOne(event, "swaps.cancelled", "partner", context);
  },
};
