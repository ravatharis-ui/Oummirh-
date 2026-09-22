import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { createAdminSupabaseClient } from "@/core/db/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
 * Late arrivals and forgotten departures.
 *
 * Called every ten minutes. The function itself decides whether it is inside the
 * working window and whether an alert has already been sent today: this route
 * carries no business rule, so the cadence can be changed without touching what
 * counts as late.
 */
async function handle(request: Request): Promise<NextResponse> {
  if (!authorised(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("pointage_run_checks");

  if (error) {
    console.error("[cron/pointage] Vérifications interrompues", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: data });
}

export const GET = handle;
export const POST = handle;
