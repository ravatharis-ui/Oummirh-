import { LayoutDashboard } from "lucide-react";
import type React from "react";

import { requireAdmin } from "@/core/auth";
import type { NavItem } from "@/core/modules";
import { AdminShell } from "@/core/ui/admin-shell";

import { toShellNavItems } from "../nav-items";
import { getRegistry } from "../registry";

export const dynamic = "force-dynamic";

const CORE_NAV: NavItem[] = [
  { label: "Tableau de bord", href: "/admin", icon: LayoutDashboard, roles: ["admin"] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Redirects to /admin/connexion unless the session carries the admin role.
  await requireAdmin();

  const registry = await getRegistry();
  const items = await toShellNavItems([...CORE_NAV, ...registry.nav("admin", "admin")]);

  return <AdminShell items={items}>{children}</AdminShell>;
}
