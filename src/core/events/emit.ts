import "server-only";

import { createAdminSupabaseClient } from "@/core/db/admin";
import type { Json } from "@/core/db";

/**
 * Emits a domain event from application code.
 *
 * Most events are emitted from inside SQL instead, by the module RPC that made
 * the business change, so the event and the change commit together. Use this one
 * only where there is no transaction to join, such as a manual test.
 */
export async function emitEvent(
  type: string,
  payload: Json = {},
  actorId?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("emit_event", {
    p_type: type,
    p_payload: payload,
    ...(actorId ? { p_actor_id: actorId } : {}),
  });

  if (error) {
    console.error(`[events] Émission impossible (${type})`, error.message);
    return { ok: false, error: "Impossible d'enregistrer l'événement." };
  }

  return { ok: true, id: data };
}
