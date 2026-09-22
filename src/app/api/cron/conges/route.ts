import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { createAdminSupabaseClient } from "@/core/db/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function matches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorised(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!token) return false;

  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && matches(token, secret as string);
}

/**
 * Acquisition mensuelle et clôture de période.
 *
 * Appelée tous les jours, et non le 1er du mois : les deux fonctions sont
 * idempotentes — index uniques à l'appui —, donc un passage quotidien ne
 * crédite jamais deux fois. En échange, une journée où la plateforme aurait
 * hoqueté ne fait perdre les congés de personne : le lendemain rattrape.
 */
async function handle(request: Request): Promise<NextResponse> {
  if (!authorised(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();

  const { data: accrued, error: accrualError } = await admin.rpc("accrue_monthly_leave", {});
  if (accrualError) {
    console.error("[cron/conges] Acquisition impossible", accrualError.message);
    return NextResponse.json({ ok: false, error: accrualError.message }, { status: 500 });
  }

  const { data: closed, error: closeError } = await admin.rpc("close_leave_period", {});
  if (closeError) {
    console.error("[cron/conges] Clôture impossible", closeError.message);
    return NextResponse.json({ ok: false, error: closeError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, accrued: accrued ?? 0, closed: closed ?? 0 });
}

export const GET = handle;
export const POST = handle;
