import "server-only";

import { createAdminSupabaseClient } from "@/core/db/admin";

/**
 * Finds a real, deliverable address for a user, or `null`.
 *
 * A collaboratrice signs in with a technical address under a `.invalid` domain,
 * which RFC 2606 guarantees can never resolve. Mailing it would bounce forever,
 * so the check is on the reserved suffix rather than on one hardcoded domain.
 * Her real address, if she gave one, lives on her employee record.
 */
export async function resolveRecipientEmail(userId: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();

  const { data: employee } = await admin
    .from("employees")
    .select("email")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (employee?.email) return employee.email;

  const { data: account } = await admin.auth.admin.getUserById(userId);
  const address = account.user?.email ?? null;
  if (!address || address.toLowerCase().endsWith(".invalid")) return null;

  return address;
}
