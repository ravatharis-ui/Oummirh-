import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/core/env";

import type { Database } from "./database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * It carries the caller's session cookie, so Row Level Security applies exactly
 * as it does in the browser. This is the client to reach for by default: it is
 * the one that cannot accidentally read another employee's data.
 */
export async function createServerSupabaseClient() {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot write cookies once rendering has started.
            // Refreshing the session is the middleware's job, added in Phase 2.
          }
        },
      },
    },
  );
}
