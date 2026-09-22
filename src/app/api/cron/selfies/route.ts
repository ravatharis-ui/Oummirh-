import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { createAdminSupabaseClient } from "@/core/db/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 200;

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
 * Selfie retention.
 *
 * Postgres cannot delete a file from Storage, so the purge is in two steps: the
 * database says what is past its retention, this route deletes the objects
 * through the Storage API, and the database then forgets the paths. If the route
 * dies in between, the next run picks the same paths up again — nothing is lost
 * and nothing is done twice.
 *
 * The pointings themselves are never deleted. Only the photograph is.
 */
async function handle(request: Request): Promise<NextResponse> {
  if (!authorised(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();

  const { data: rows, error } = await admin.rpc("selfies_to_purge", { p_limit: BATCH });
  if (error) {
    console.error("[cron/selfies] Liste impossible", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const paths = (rows ?? []).map((row) => row.photo_path).filter(Boolean);
  if (paths.length === 0) return NextResponse.json({ ok: true, purged: 0 });

  const { error: storageError } = await admin.storage.from("selfies").remove(paths);
  if (storageError) {
    console.error("[cron/selfies] Suppression impossible", storageError.message);
    return NextResponse.json({ ok: false, error: storageError.message }, { status: 500 });
  }

  const { data: purged, error: markError } = await admin.rpc("mark_selfies_purged", {
    p_paths: paths,
  });

  if (markError) {
    console.error("[cron/selfies] Chemins non effacés", markError.message);
    return NextResponse.json({ ok: false, error: markError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, purged: purged ?? 0 });
}

export const GET = handle;
export const POST = handle;
