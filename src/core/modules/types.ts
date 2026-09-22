import type { Route } from "next";
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
  href: Route;
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

/**
 * What a handler is given besides the event itself.
 *
 * `notify` is already bound to the active registry, so a handler announces
 * something without knowing how notifications are rendered or delivered.
 * Later phases add to this object rather than to the handler signature.
 */
export interface EventContext {
  notify: (recipientUserId: string, type: string, payload?: unknown) => Promise<void>;
}

export type EventHandler = (event: DomainEvent, context: EventContext) => Promise<void>;

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
