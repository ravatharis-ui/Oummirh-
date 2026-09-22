import type { Route } from "next";
import type { ReactNode } from "react";

/**
 * A navigation entry ready to cross the server/client boundary.
 *
 * `AppModule` nav items carry an icon *component* and an async `badgeQuery`, neither
 * of which can be serialised. Layouts therefore render the icon and await the badge
 * on the server, and hand the shells this plain, serialisable shape.
 */
export interface ShellNavItem {
  label: string;
  href: Route;
  icon: ReactNode;
  badge: number | null;
}
