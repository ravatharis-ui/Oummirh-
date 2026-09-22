import { NextResponse } from "next/server";
import { z } from "zod";

import { clientIp } from "@/core/auth/client-ip";
import { createAdminSupabaseClient } from "@/core/db/admin";
import { createServerSupabaseClient } from "@/core/db/server";

export const runtime = "nodejs";
// A login must never be served from a cache.
export const dynamic = "force-dynamic";

/** Remembers who last signed in on this phone, so she lands straight on her keypad. */
const LAST_EMPLOYEE_COOKIE = "oummi_last_employee";
const LAST_EMPLOYEE_MAX_AGE = 60 * 60 * 24 * 30;

/** Burst protection per IP, on top of the per-employee lockout enforced in SQL. */
const IP_ATTEMPT_LIMIT = 20;
const IP_WINDOW_SECONDS = 60;

/** Slows down guessing and hides whether a name exists, by timing. */
const FAILURE_DELAY_MS = 400;

const bodySchema = z.object({
  employeeId: z.string().uuid("Collaboratrice inconnue."),
  pin: z.string().regex(/^[0-9]{4}$/, "Le code doit comporter 4 chiffres."),
});

/**
 * The RPC result crosses a trust boundary, so it is parsed rather than cast:
 * the generated types describe the declared shape, not what actually came back.
 */
const verifySchema = z.object({
  status: z.enum(["ok", "invalid_pin", "locked", "unknown_employee"]),
  auth_user_id: z.string().uuid().nullable(),
  auth_email: z.string().nullable(),
  locked_until: z.string().nullable(),
  attempts_left: z.number().int().nullable(),
});

type Failure = { ok: false; error: string; attemptsLeft?: number; lockedUntil?: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fail(body: Failure, status: number): Promise<NextResponse> {
  await sleep(FAILURE_DELAY_MS);
  return NextResponse.json(body, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail({ ok: false, error: "Code invalide." }, 400);
  }

  const { employeeId, pin } = parsed.data;
  const ip = clientIp(request.headers);
  const admin = createAdminSupabaseClient();

  // Durable throttle: counted in the database, so it holds across server instances.
  if (ip) {
    const since = new Date(Date.now() - IP_WINDOW_SECONDS * 1000).toISOString();
    const { count } = await admin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", since);

    if ((count ?? 0) >= IP_ATTEMPT_LIMIT) {
      return fail({ ok: false, error: "Trop de tentatives. Patientez une minute." }, 429);
    }
  }

  const { data, error } = await admin.rpc("verify_employee_pin", {
    p_employee_id: employeeId,
    p_pin: pin,
    p_ip: ip,
  });

  if (error) {
    console.error("[auth/pin] Vérification impossible", error.message);
    return fail({ ok: false, error: "Connexion impossible pour le moment. Réessayez." }, 500);
  }

  const result = verifySchema.safeParse(Array.isArray(data) ? data[0] : data);
  if (!result.success) {
    console.error("[auth/pin] Réponse inattendue de la base");
    return fail({ ok: false, error: "Connexion impossible pour le moment. Réessayez." }, 500);
  }

  const verification = result.data;

  if (verification.status === "locked") {
    return fail(
      {
        ok: false,
        error:
          "Trop d'essais. Votre compte est bloqué 15 minutes. Prévenez la direction si besoin.",
        ...(verification.locked_until ? { lockedUntil: verification.locked_until } : {}),
      },
      423,
    );
  }

  if (verification.status !== "ok") {
    // Same wording whether the name is unknown or the code is wrong: a login screen
    // should not tell a stranger which names exist.
    const left = verification.attempts_left;
    return fail(
      {
        ok: false,
        error:
          left !== null && left > 0
            ? `Code incorrect. Il vous reste ${left} essai${left > 1 ? "s" : ""}.`
            : "Code incorrect.",
        ...(left !== null ? { attemptsLeft: left } : {}),
      },
      401,
    );
  }

  if (!verification.auth_email) {
    console.error("[auth/pin] Compte sans adresse technique", employeeId);
    return fail({ ok: false, error: "Ce compte est incomplet. Prévenez la direction." }, 500);
  }

  // A one-time magic link is generated but never sent: only its hashed token is
  // used, server side, to open the session and write the cookies.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: verification.auth_email,
  });

  if (linkError || !link?.properties?.hashed_token) {
    console.error("[auth/pin] Génération de session impossible", linkError?.message);
    return fail({ ok: false, error: "Connexion impossible pour le moment. Réessayez." }, 500);
  }

  const supabase = await createServerSupabaseClient();
  const { error: otpError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });

  if (otpError) {
    console.error("[auth/pin] Ouverture de session impossible", otpError.message);
    return fail({ ok: false, error: "Connexion impossible pour le moment. Réessayez." }, 500);
  }

  const response = NextResponse.json({ ok: true as const });
  response.cookies.set(LAST_EMPLOYEE_COOKIE, employeeId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: LAST_EMPLOYEE_MAX_AGE,
    path: "/",
  });
  return response;
}
