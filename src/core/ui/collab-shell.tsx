import { Bell } from "lucide-react";
import type { ReactNode } from "react";

import { NavLink } from "./nav-link";
import type { ShellNavItem } from "./shell-types";

interface CollabShellProps {
  items: ShellNavItem[];
  children: ReactNode;
  /** Temporary notice while a space is still a scaffold. */
  notice?: string;
}

/**
 * Employee space: mobile first, one thumb, bottom tab bar.
 * Touch targets are at least 48 px and body text at least 16 px.
 */
export function CollabShell({ items, children, notice }: CollabShellProps) {
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="bg-background/95 sticky top-0 z-10 flex h-14 items-center justify-between border-b px-4 backdrop-blur">
        <span className="text-lg font-semibold">Oummi RH</span>
        <span
          className="text-muted-foreground flex size-12 items-center justify-center"
          title="Les notifications arrivent en Phase 3"
          aria-hidden
        >
          <Bell className="size-5" />
        </span>
      </header>

      {notice ? (
        <p className="bg-secondary text-secondary-foreground border-b px-4 py-2 text-sm">
          {notice}
        </p>
      ) : null}

      <main className="flex-1 px-4 py-5 pb-28">{children}</main>

      <nav
        aria-label="Navigation principale"
        className="bg-background/95 fixed inset-x-0 bottom-0 z-10 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto flex max-w-lg items-stretch gap-1 px-2 py-1.5">
          {items.map((item) => (
            <li key={item.href} className="flex flex-1">
              <NavLink item={item} variant="bottom" />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
