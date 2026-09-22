import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/core/env";

import type { Database } from "./database.types";

/**
 * Supabase client for the browser, using the public anon key.
 *
 * Every read and write it performs is subject to Row Level Security, so this
 * client can only ever see what the signed-in user is allowed to see.
 * Import it from client components only.
 */
export function createBrowserSupabaseClient() {
  const env = getPublicEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
