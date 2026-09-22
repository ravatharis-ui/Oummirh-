import "server-only";

import { redirect } from "next/navigation";

import { getCurrentEmployeeId, getCurrentRoles, getCurrentUser, type SessionUser } from "./session";

export interface EmployeeContext {
  user: SessionUser;
  employeeId: string;
}

export interface AdminContext {
  user: SessionUser;
}

/**
 * Guards.
 *
 * They are the first line of every layout and every server action. They are a
 * convenience, not the security boundary: Row Level Security is what actually
 * stops one collaboratrice reading another's rows, and it applies even if a guard
 * is forgotten.
 */
export async function requireEmployee(): Promise<EmployeeContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) redirect("/connexion");

  return { user, employeeId };
}

export async function requireAdmin(): Promise<AdminContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/connexion");

  const roles = await getCurrentRoles();
  if (!roles.includes("admin")) redirect("/admin/connexion");

  return { user };
}

/** Non-redirecting variant, for deciding what to render rather than who may enter. */
export async function isAdmin(): Promise<boolean> {
  return (await getCurrentRoles()).includes("admin");
}
