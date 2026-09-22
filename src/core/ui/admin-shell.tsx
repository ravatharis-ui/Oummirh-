import { Bell } from "lucide-react";
import type { ReactNode } from "react";

import { NavLink } from "./nav-link";
import type { ShellNavItem } from "./shell-types";

interface AdminShellProps {
  items: ShellNavItem[];
  children: ReactNode;
  /** Optional banner, e.g. a maintenance notice. */
  notice?: string;
}

/** Direction space: desktop first, sidebar on the left, still usable on a phone. */
export function AdminShell({ items, children, notice }: AdminShellProps) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="bg-secondary/40 border-b md:w-64 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex h-14 items-center justify-between px-4 md:px-5">
          <div>
            <span className="text-lg font-semibold">Oummi RH</span>
            <span className="text-muted-foreground ml-2 text-sm">Direction</span>
          </div>
          <span
            className="text-muted-foreground flex size-10 items-center justify-center md:hidden"
            title="Les notifications arrivent en Phase 3"
            aria-hidden
          >
            <Bell className="size-5" />
          </span>
        </div>

        <nav aria-label="Navigation principale" className="px-2 pb-3 md:px-3">
          <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {items.map((item) => (
              <li key={item.href} className="md:w-full">
                <NavLink item={item} variant="side" />
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {notice ? (
          <p className="bg-secondary text-secondary-foreground border-b px-6 py-2 text-sm">
            {notice}
          </p>
        ) : null}
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
