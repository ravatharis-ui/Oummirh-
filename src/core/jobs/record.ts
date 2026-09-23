import "server-only";

import { createAdminSupabaseClient } from "@/core/db/admin";
import type { Json } from "@/core/db/database.types";

/**
 * Records the outcome of one scheduled pass.
 *
 * It never throws, and never turns a successful task into a failed one. The
 * recording exists so that a silent breakdown becomes visible; making a task
 * fail because its bookkeeping failed would be exactly the wrong trade.
 */
export async function recordJobRun(
  job: string,
  ok: boolean,
  summary: object = {},
  error: string | null = null,
): Promise<void> {
  try {
    const admin = createAdminSupabaseClient();

    // A real conversion, not a cast: what a task hands back may carry Error
    // objects or other things a jsonb column cannot hold, and round-tripping
    // through JSON drops exactly those rather than failing the insert.
    const payload: Json = JSON.parse(JSON.stringify(summary ?? {})) as Json;

    const { error: rpcError } = await admin.rpc("record_job_run", {
      p_job: job,
      p_ok: ok,
      p_summary: payload,
      ...(error ? { p_error: error } : {}),
    });

    if (rpcError) {
      console.warn(`[jobs] Passage de « ${job} » non enregistré : ${rpcError.message}`);
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.warn(`[jobs] Passage de « ${job} » non enregistré : ${message}`);
  }
}
