import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { recordJobRun } from "./record";

/** What a scheduled task reports when it finishes: counts, never prose. */
export type ScheduledResult = object;

/** Constant-time comparison: a fast reject leaks the secret one character at a time. */
function matches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorised(request: Request, secrets: readonly (string | undefined)[]): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!token) return false;

  const accepted = secrets.filter((secret): secret is string => Boolean(secret));
  return accepted.some((secret) => matches(token, secret));
}

interface ScheduledRouteOptions {
  /** Registry key. The same one the dashboard card reads. */
  job: string;
  /**
   * Which secrets open the door. Defaults to `CRON_SECRET` alone; the event
   * dispatcher also accepts the Supabase webhook's own secret.
   */
  secrets?: () => readonly (string | undefined)[];
  run: () => Promise<ScheduledResult>;
}

/**
 * Wraps a scheduled task into a route handler.
 *
 * The recording is part of the wrapper rather than a line to remember in each
 * route. That is the whole point: a task whose author forgot to report its pass
 * would show up on the dashboard as broken, and a health screen that cries wolf
 * is worse than no health screen. Here it cannot be forgotten.
 *
 * An unauthorised call records nothing. Someone knocking on the door is not a
 * pass, and counting it as a failure would let anyone paint the card red.
 */
export function scheduledRoute({ job, secrets, run }: ScheduledRouteOptions) {
  return async function handle(request: Request): Promise<NextResponse> {
    const accepted = secrets?.() ?? [process.env.CRON_SECRET];

    if (!authorised(request, accepted)) {
      return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
    }

    try {
      const summary = await run();
      await recordJobRun(job, true, summary);
      return NextResponse.json({ ok: true, ...summary });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      console.error(`[jobs] « ${job} » a échoué`, message);
      await recordJobRun(job, false, {}, message);
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  };
}
