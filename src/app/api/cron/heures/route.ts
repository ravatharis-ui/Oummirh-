import { createAdminSupabaseClient } from "@/core/db/admin";
import { scheduledRoute } from "@/core/jobs";
import { addDays, todayInReunion } from "@/core/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Le calcul quotidien des heures.
 *
 * Hier autant qu'aujourd'hui : une journée close après le passage de la veille —
 * un départ pointé à minuit vingt — doit finir par être comptée. La fonction est
 * idempotente, donc repasser sur une journée déjà calculée la met simplement à
 * jour.
 *
 * Le calcul se fait aussi à chaud, quand un départ est pointé ou qu'une
 * correction est saisie. Cette tâche est le filet, pas le mécanisme.
 */
const handle = scheduledRoute({
  job: "heures.daily",
  run: async () => {
    const admin = createAdminSupabaseClient();
    const today = todayInReunion();
    const days = [today, addDays(today, -1)];

    let computed = 0;

    for (const day of days) {
      const { data, error } = await admin.rpc("compute_daily_hours", { p_date: day });
      if (error) throw new Error(error.message);
      computed += data ?? 0;
    }

    return { days, computed };
  },
});

export const GET = handle;
export const POST = handle;
