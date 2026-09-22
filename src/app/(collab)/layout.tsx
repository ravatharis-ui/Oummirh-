import { Home, UserRound } from "lucide-react";
import type React from "react";

import { requireEmployee } from "@/core/auth";
import type { NavItem } from "@/core/modules";
import { CollabShell } from "@/core/ui/collab-shell";
import { NotificationBell } from "@/core/ui/notification-bell";

import { toShellNavItems } from "../nav-items";
import { getRegistry } from "../registry";

// The menu depends on the signed-in user and on settings, so never prerender it.
export const dynamic = "force-dynamic";

/** Core entries. Everything after them is contributed by modules via the registry. */
const CORE_NAV: NavItem[] = [
  { label: "Accueil", href: "/accueil", icon: Home, roles: ["employee"] },
];

/** Always last in the tab bar, whatever modules contribute in between. */
const PROFILE_NAV: NavItem[] = [
  { label: "Profil", href: "/profil", icon: UserRound, roles: ["employee"] },
];

export default async function CollabLayout({ children }: { children: React.ReactNode }) {
  // Redirects to /connexion when there is no session, before anything renders.
  const { user } = await requireEmployee();

  const registry = await getRegistry();
  const items = await toShellNavItems([
    ...CORE_NAV,
    ...registry.nav("collab", "employee"),
    ...PROFILE_NAV,
  ]);

  return (
    <CollabShell items={items} bell={<NotificationBell userId={user.id} />}>
      {children}
    </CollabShell>
  );
}
