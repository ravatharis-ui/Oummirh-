import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { dispatchPendingEvents } from "@/core/events";
import { createNotifier } from "@/core/notifications";

import { getRegistry } from "../../../registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Handlers touch the database and send mail; a slow batch must not be cut short.
export const maxDuration = 60;

/** Constant-time comparison: a fast reject leaks the secret one character at a time. */
function matches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * The route is called from two places, with two different secrets:
 *   - the Supabase database webhook, right after an event row is inserted;
 *   - the Vercel cron, which sends `Authorization: Bearer $CRON_SECRET`.
 * Either is enough. Neither being configured means the route stays shut.
 */
function authorised(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!token) return false;

  const accepted = [process.env.EVENTS_DISPATCH_SECRET, process.env.CRON_SECRET].filter(
    (secret): secret is string => Boolean(secret),
  );

  return accepted.some((secret) => matches(token, secret));
}

async function handle(request: Request): Promise<NextResponse> {
  if (!authorised(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  }

  try {
    const registry = await getRegistry();
    const result = await dispatchPendingEvents({
      registry,
      context: { notify: createNotifier(registry) },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error("[events/dispatch] Passe interrompue", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** The webhook posts; the cron gets. */
export const POST = handle;
export const GET = handle;
