import { dispatchPendingEvents } from "@/core/events";
import { scheduledRoute } from "@/core/jobs";
import { createNotifier } from "@/core/notifications";

import { getRegistry } from "../../../registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Handlers touch the database and send mail; a slow batch must not be cut short.
export const maxDuration = 60;

/**
 * The route is called from two places, with two different secrets:
 *   - the Supabase database webhook, right after an event row is inserted;
 *   - the Vercel cron, which sends `Authorization: Bearer $CRON_SECRET`.
 * Either is enough. Neither being configured means the route stays shut.
 */
const handle = scheduledRoute({
  job: "events.dispatch",
  secrets: () => [process.env.EVENTS_DISPATCH_SECRET, process.env.CRON_SECRET],
  run: async () => {
    const registry = await getRegistry();
    return dispatchPendingEvents({
      registry,
      context: { notify: createNotifier(registry) },
    });
  },
});

/** The webhook posts; the cron gets. */
export const POST = handle;
export const GET = handle;
