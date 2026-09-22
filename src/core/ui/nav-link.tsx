"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { ShellNavItem } from "./shell-types";
import { cn } from "./utils";

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface NavLinkProps {
  item: ShellNavItem;
  /** `bottom` for the mobile tab bar, `side` for the desktop sidebar. */
  variant: "bottom" | "side";
}

export function NavLink({ item, variant }: NavLinkProps) {
  const pathname = usePathname();
  const active = isActivePath(pathname, item.href);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl transition-colors",
        variant === "bottom"
          ? "min-h-12 flex-1 flex-col justify-center gap-1 px-1 py-2 text-xs"
          : "min-h-12 px-3 py-2 text-base",
        active
          ? "bg-secondary text-foreground font-medium"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      <span className="relative flex items-center">
        {item.icon}
        {item.badge !== null && item.badge > 0 ? (
          <span
            className="bg-primary text-primary-foreground absolute -top-1.5 -right-2 min-w-5 rounded-full px-1 text-center text-[11px] leading-5 font-semibold"
            aria-label={`${item.badge} en attente`}
          >
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        ) : null}
      </span>
      <span className={cn(variant === "bottom" && "leading-tight")}>{item.label}</span>
    </Link>
  );
}
