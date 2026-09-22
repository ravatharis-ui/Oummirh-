/**
 * Types only.
 *
 * The clients are imported from their own paths on purpose, so that a server-only
 * client can never be pulled into a browser bundle through a shared barrel file:
 *   - `@/core/db/client` — browser, anon key, RLS applies
 *   - `@/core/db/server` — server, session cookie, RLS applies
 *   - `@/core/db/admin`  — server, service_role, RLS bypassed
 */
export type { Database, Json } from "./database.types";
export type * from "./types";
