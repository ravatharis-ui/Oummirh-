import { Home } from "lucide-react";
import type React from "react";

import type { NavItem } from "@/core/modules";
import { CollabShell } from "@/core/ui/collab-shell";

import { toShellNavItems } from "../nav-items";
import { getRegistry } from "../registry";

// The menu depends on the signed-in user and on settings, so never prerender it.
export const dynamic = "force-dynamic";

/** Core entries. Everything after them is contributed by modules via the registry. */
const CORE_NAV: NavItem[] = [
  { label: "Accueil", href: "/accueil", icon: Home, roles: ["employee"] },
];

export default async function CollabLayout({ children }: { children: React.ReactNode }) {
  const registry = await getRegistry();
  // Phase 2 replaces this with requireEmployee(), which also resolves the real role.
  const items = await toShellNavItems([...CORE_NAV, ...registry.nav("collab", "employee")]);

  return (
    <CollabShell
      items={items}
      notice="Phase 1 — aperçu de l'espace collaboratrice. La connexion arrive en Phase 2."
    >
      {children}
    </CollabShell>
  );
}
