import { createAdminSupabaseClient } from "@/core/db/admin";
import { scheduledRoute } from "@/core/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Acquisition mensuelle et clôture de période.
 *
 * Appelée tous les jours, et non le 1er du mois : les deux fonctions sont
 * idempotentes — index uniques à l'appui —, donc un passage quotidien ne
 * crédite jamais deux fois. En échange, une journée où la plateforme aurait
 * hoqueté ne fait perdre les congés de personne : le lendemain rattrape.
 */
const handle = scheduledRoute({
  job: "conges.accrual",
  run: async () => {
    const admin = createAdminSupabaseClient();

    const { data: accrued, error: accrualError } = await admin.rpc("accrue_monthly_leave", {});
    if (accrualError) throw new Error(accrualError.message);

    const { data: closed, error: closeError } = await admin.rpc("close_leave_period", {});
    if (closeError) throw new Error(closeError.message);

    return { accrued: accrued ?? 0, closed: closed ?? 0 };
  },
});

export const GET = handle;
export const POST = handle;
