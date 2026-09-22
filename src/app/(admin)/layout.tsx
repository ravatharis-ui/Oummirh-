import { LayoutDashboard } from "lucide-react";
import type React from "react";

import type { NavItem } from "@/core/modules";
import { AdminShell } from "@/core/ui/admin-shell";

import { toShellNavItems } from "../nav-items";
import { getRegistry } from "../registry";

export const dynamic = "force-dynamic";

const CORE_NAV: NavItem[] = [
  { label: "Tableau de bord", href: "/admin", icon: LayoutDashboard, roles: ["admin"] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const registry = await getRegistry();
  // Phase 2 replaces this with requireAdmin().
  const items = await toShellNavItems([...CORE_NAV, ...registry.nav("admin", "admin")]);

  return (
    <AdminShell
      items={items}
      notice="Phase 1 — aperçu de l'espace direction. La connexion arrive en Phase 2."
    >
      {children}
    </AdminShell>
  );
}
