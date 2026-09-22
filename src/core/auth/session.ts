import "server-only";

import { tryCreateServerSupabaseClient } from "@/core/db/server";
import type { Role } from "@/core/modules";

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * The signed-in user, verified against the Auth server.
 *
 * `getUser()` and not `getSession()`: the session cookie is attacker-controlled
 * storage, so its contents are never trusted for an authorisation decision.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await tryCreateServerSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/** Roles granted to the signed-in user. Empty when signed out. */
export async function getCurrentRoles(): Promise<Role[]> {
  const supabase = await tryCreateServerSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.from("user_roles").select("role");
  if (error || !data) return [];

  const known: Role[] = ["employee", "admin", "manager"];
  return data.map((row) => row.role).filter((role): role is Role => known.includes(role as Role));
}

/**
 * The employee record tied to the signed-in user, if any.
 *
 * Goes through the `current_employee_id()` function rather than the employees
 * table, so `core/` depends on a documented SQL contract instead of a module's
 * table layout.
 */
export async function getCurrentEmployeeId(): Promise<string | null> {
  const supabase = await tryCreateServerSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("current_employee_id");
  if (error) return null;
  return data ?? null;
}
