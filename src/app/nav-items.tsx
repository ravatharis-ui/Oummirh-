import type { NavItem } from "@/core/modules";
import type { ShellNavItem } from "@/core/ui/shell-types";

/**
 * Turns registry nav items into something a client shell can receive.
 *
 * The icon is rendered here, on the server, because a component reference cannot
 * cross the server/client boundary; the rendered element can. Badge counters are
 * awaited for the same reason.
 */
export async function toShellNavItems(items: readonly NavItem[]): Promise<ShellNavItem[]> {
  return Promise.all(
    items.map(async (item) => ({
      label: item.label,
      href: item.href,
      icon: <item.icon className="size-5" aria-hidden />,
      badge: item.badgeQuery ? await item.badgeQuery() : null,
    })),
  );
}
