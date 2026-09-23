import { createAdminSupabaseClient } from "@/core/db/admin";
import { scheduledRoute } from "@/core/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Late arrivals and forgotten departures.
 *
 * Called every ten minutes. The function itself decides whether it is inside the
 * working window and whether an alert has already been sent today: this route
 * carries no business rule, so the cadence can be changed without touching what
 * counts as late.
 */
const handle = scheduledRoute({
  job: "pointage.checks",
  run: async () => {
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin.rpc("pointage_run_checks");
    if (error) throw new Error(error.message);

    return { result: data };
  },
});

export const GET = handle;
export const POST = handle;
