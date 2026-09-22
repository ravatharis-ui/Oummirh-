"use server";

import type { ActionResult } from "@/core/actions";
import { requireAdmin } from "@/core/auth";
import { dispatchPendingEvents } from "@/core/events";
import { createNotifier } from "@/core/notifications";

import { getRegistry } from "../../../registry";

export interface DispatchSummary {
  claimed: number;
  processed: number;
  failed: number;
}

/**
 * Runs one dispatch pass on demand.
 *
 * It lives in the application layer, not in the demo module, because building the
 * registry means knowing every module, and a module must never reach upwards.
 * ESLint enforces that direction, and it caught this exact mistake.
 *
 * In production the Supabase webhook fires a pass the instant an event is
 * written, and the cron catches up on failures. This button exists so the chain
 * can be proven before either is configured, and so a failure can be watched
 * attempt by attempt rather than waited out.
 */
export async function dispatchNow(): Promise<ActionResult<DispatchSummary>> {
  await requireAdmin();

  try {
    const registry = await getRegistry();
    const result = await dispatchPendingEvents({
      registry,
      context: { notify: createNotifier(registry) },
    });
    return {
      ok: true,
      data: { claimed: result.claimed, processed: result.processed, failed: result.failed },
    };
  } catch (cause) {
    console.error("[demo] Passe de distribution impossible", cause);
    return { ok: false, error: "Impossible de traiter la file. Consultez les journaux." };
  }
}
