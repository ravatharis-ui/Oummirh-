import "server-only";

import { createAdminSupabaseClient } from "@/core/db/admin";
import type { DomainEvent, EventContext, Registry } from "@/core/modules";

import type { DispatchFailure, DispatchResult } from "./types";

const DEFAULT_BATCH = 20;
const MAX_ATTEMPTS = 5;

interface RawEvent {
  id: string;
  type: string;
  payload: unknown;
  actor_id: string | null;
  created_at: string;
  attempts: number;
}

function toDomainEvent(row: RawEvent): DomainEvent {
  return {
    id: row.id,
    type: row.type,
    payload: row.payload,
    actorId: row.actor_id,
    createdAt: row.created_at,
  };
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export interface DispatchOptions {
  registry: Registry;
  context: EventContext;
  batchSize?: number;
}

/**
 * Runs one pass over the pending events.
 *
 * Two properties make this safe to call from two places at once, which is
 * exactly what happens when the webhook fires while the cron is catching up:
 *
 * - claiming uses `for update skip locked`, so two passes never take the same row;
 * - handlers are idempotent by contract, so a replay after a crash is harmless.
 *
 * One failing handler fails its event, and nothing else. An event whose handlers
 * all succeed is marked processed; an event that has burned its five attempts is
 * left alone with its last error, for the direction to look at.
 */
export async function dispatchPendingEvents({
  registry,
  context,
  batchSize = DEFAULT_BATCH,
}: DispatchOptions): Promise<DispatchResult & { failures: DispatchFailure[] }> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin.rpc("claim_domain_events", {
    p_limit: batchSize,
    p_max_attempts: MAX_ATTEMPTS,
  });

  if (error) {
    throw new Error(`Réservation des événements impossible : ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RawEvent[];
  const failures: DispatchFailure[] = [];
  let processed = 0;

  for (const row of rows) {
    const event = toDomainEvent(row);
    const handlers = registry.eventHandlers.get(event.type) ?? [];

    try {
      // Sequential on purpose: handlers of one event often touch the same rows,
      // and a predictable order makes a failure far easier to read.
      for (const { module, handler } of handlers) {
        try {
          await handler(event, context);
        } catch (cause) {
          throw new Error(`module « ${module} » : ${describe(cause)}`);
        }
      }

      await admin.rpc("mark_event_processed", { p_id: event.id });
      processed += 1;
    } catch (cause) {
      const message = describe(cause);
      await admin.rpc("mark_event_failed", { p_id: event.id, p_error: message });
      failures.push({
        eventId: event.id,
        type: event.type,
        message,
        abandoned: row.attempts >= MAX_ATTEMPTS,
      });
      console.error(
        `[events] ${event.type} a échoué (tentative ${row.attempts}/${MAX_ATTEMPTS})`,
        message,
      );
    }
  }

  return { claimed: rows.length, processed, failed: failures.length, failures };
}
