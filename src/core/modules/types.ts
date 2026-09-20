import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

/** Roles known by the application. `manager` is reserved for a future module. */
export type Role = "employee" | "admin" | "manager";

/** A domain event as stored in the `domain_events` outbox table. */
export interface DomainEvent<TPayload = unknown> {
  id: string;
  type: string;
  payload: TPayload;
  actorId: string | null;
  createdAt: string;
}

export interface NavItem {
  /** Label shown in the menu (French). */
  label: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
  /** Optional counter (e.g. pending requests) rendered as a badge. */
  badgeQuery?: () => Promise<number>;
}

export interface NotificationTypeDef<TPayload = unknown> {
  /** Fully qualified type, e.g. `conges.request_approved`. */
  type: string;
  title: (payload: TPayload) => string;
  body: (payload: TPayload) => string;
  href?: (payload: TPayload) => string;
  /** Also send an email when the recipient has an address. */
  email?: boolean;
}

export type EventHandler = (event: DomainEvent) => Promise<void>;

export interface AppModule {
  /** Stable key, also used in `settings.modules_enabled` (e.g. `conges`). */
  key: string;
  /** Human name (French), e.g. `Congés`. */
  name: string;
  /** Static default; the registry also honours `settings.modules_enabled`. */
  enabled: boolean;
  nav: { collab?: NavItem[]; admin?: NavItem[] };
  notificationTypes?: NotificationTypeDef[];
  /** Event type → idempotent handler. */
  eventHandlers?: Record<string, EventHandler>;
  dashboardWidgets?: { collab?: ComponentType[]; admin?: ComponentType[] };
}
