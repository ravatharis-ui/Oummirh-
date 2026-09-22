import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv, getServerEnv } from "@/core/env";

import type { Database } from "./database.types";

/**
 * Supabase client using the `service_role` key.
 *
 * DANGER: this client bypasses Row Level Security entirely. Use it only where the
 * code has already established who the caller is and what they may do, for example
 * the PIN login route handler (Phase 2) and the event dispatcher (Phase 3).
 * It must never be imported by a client component, and its key must never be sent
 * to the browser. The `server-only` import above turns a mistake into a build error.
 */
export function createAdminSupabaseClient() {
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();

  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    },
  );
}
