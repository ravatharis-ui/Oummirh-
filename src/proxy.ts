import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/core/env";
import { buildCsp, cspHeaderName } from "@/core/security/csp";

/**
 * Keeps the session alive, and carries the Content-Security-Policy.
 *
 * The file is `proxy.ts` and not `middleware.ts`: Next 16 renamed the
 * convention, and the old name now prints a deprecation warning on every build.
 * Same behaviour, same position in the request, different export name.
 *
 * Access tokens are short-lived. Without this, a collaboratrice who leaves the app
 * open would be signed out mid-shift. Refreshing here, where cookies can still be
 * written, is what lets Server Components simply read the session.
 *
 * It refreshes; it does not authorise. Access decisions live in the layouts'
 * guards and, definitively, in Row Level Security.
 */
export async function proxy(request: NextRequest) {
  // La politique de sécurité du contenu, d'abord. Elle doit être posée même si
  // tout le reste échoue : une page rendue sans CSP est une page sans filet.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDevelopment = process.env.NODE_ENV === "development";
  const reportOnly = process.env.CSP_REPORT_ONLY === "1";

  const csp = buildCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    isDevelopment,
  });

  // Next lit l'en-tête de la **requête** pour poser le nonce sur ses propres
  // scripts. Sans cette ligne, la politique bloquerait le framework lui-même.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(cspHeaderName(reportOnly), csp);

  // Everything below is wrapped. This runs before every single route, so a throw
  // here is not one broken page: it is the whole site answering with a platform
  // error. Refreshing a token is a convenience, and failing to refresh one must
  // never be worse than not trying.
  try {
    const env = getPublicEnv();

    const supabase = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
            // La réponse est refabriquée : il faut lui remettre la politique,
            // sinon un simple rafraîchissement de jeton la ferait disparaître.
            response = NextResponse.next({ request: { headers: requestHeaders } });
            response.headers.set(cspHeaderName(reportOnly), csp);
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      },
    );

    await supabase.auth.getUser();
  } catch (cause) {
    console.error(
      `[proxy] Rafraîchissement de session ignoré : ${cause instanceof Error ? cause.message : cause}`,
    );
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
