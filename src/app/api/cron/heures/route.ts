import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { createAdminSupabaseClient } from "@/core/db/admin";
import { addDays, todayInReunion } from "@/core/time";

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
async function handle(request: Request): Promise<NextResponse> {
  if (!authorised(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const today = todayInReunion();
  const days = [today, addDays(today, -1)];

  let total = 0;

  for (const day of days) {
    const { data, error } = await admin.rpc("compute_daily_hours", { p_date: day });

    if (error) {
      console.error("[cron/heures] Calcul impossible", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    total += data ?? 0;
  }

  return NextResponse.json({ ok: true, days, computed: total });
}

export const GET = handle;
export const POST = handle;
