import "server-only";

import { requireAdmin } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";

import { jobHealth, type JobHealth, type JobRun } from "./health";
import { JOB_DEFINITIONS } from "./registry";

/**
 * The state of every scheduled task, one entry per definition.
 *
 * Driven by the registry and not by the table: a task that has never run must
 * appear on the screen saying so. Reading the table alone would silently hide
 * the one task that never started — the single case the screen exists for.
 */
export async function getJobHealth(now: Date = new Date()): Promise<JobHealth[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("job_runs")
    .select("job, last_run_at, last_ok_at, ok, error, consecutive_failures");

  if (error) {
    console.error("[jobs] Lecture des passages impossible", error.message);
  }

  const runs = new Map<string, JobRun>(
    (data ?? []).map((row) => [
      row.job,
      {
        job: row.job,
        lastRunAt: row.last_run_at,
        lastOkAt: row.last_ok_at,
        ok: row.ok,
        error: row.error,
        consecutiveFailures: row.consecutive_failures,
      },
    ]),
  );

  return JOB_DEFINITIONS.map((definition) =>
    jobHealth(definition, runs.get(definition.key) ?? null, now),
  );
}
