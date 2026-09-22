import type { EventHandler } from "@/core/modules";

/**
 * Handlers of the demo module.
 *
 * They exist so the whole chain can be exercised end to end: emit, dispatch,
 * notify, deliver. `demo.fail` fails on purpose, which is the only honest way to
 * check that retries stop after five attempts instead of looping forever.
 *
 * Both are idempotent, as every handler must be: the dispatcher can replay an
 * event after a crash, and a replay must not notify anyone twice.
 */
export const demoEventHandlers: Record<string, EventHandler> = {
  "demo.hello": async (event, context) => {
    if (!event.actorId) return;
    await context.notify(event.actorId, "demo.hello", event.payload);
  },

  "demo.fail": async () => {
    throw new Error("Échec volontaire, pour vérifier le mécanisme de nouvelles tentatives.");
  },
};
