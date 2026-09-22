import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/core/env";

/**
 * Keeps the session alive.
 *
 * Access tokens are short-lived. Without this, a collaboratrice who leaves the app
 * open would be signed out mid-shift. Refreshing here, where cookies can still be
 * written, is what lets Server Components simply read the session.
 *
 * It refreshes; it does not authorise. Access decisions live in the layouts'
 * guards and, definitively, in Row Level Security.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  let env;
  try {
    env = getPublicEnv();
  } catch {
    // Not configured yet: serve the page so the reader sees a real message
    // rather than a platform error on every route.
    return response;
  }

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  try {
    await supabase.auth.getUser();
  } catch {
    // A transient Auth outage must not take the whole site down.
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
