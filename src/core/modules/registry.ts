import type { AppModule, EventHandler, NavItem, NotificationTypeDef, Role } from "./types";

/**
 * Module registry.
 *
 * Adding a feature = adding a folder under `src/modules/<key>/` and listing its manifest
 * in `ALL_MODULES` (see `src/core/modules/all-modules.ts`). Nothing else in the codebase
 * needs to change: menus, dashboards, notification types and event routing are all derived
 * from the registry.
 *
 * `core/` never imports a module. The list of manifests is injected by the app layer
 * through `buildRegistry()`, which keeps the dependency direction `app → core ← modules`.
 */
export interface Registry {
  modules: AppModule[];
  nav: (space: "collab" | "admin", role: Role) => NavItem[];
  notificationTypes: Map<string, NotificationTypeDef>;
  eventHandlers: Map<string, Array<{ module: string; handler: EventHandler }>>;
  widgets: (space: "collab" | "admin") => NonNullable<AppModule["dashboardWidgets"]>[typeof space];
}

export interface BuildRegistryOptions {
  /** Keys of modules disabled in `settings.modules_enabled` (overrides `manifest.enabled`). */
  disabledKeys?: ReadonlySet<string>;
}

export function buildRegistry(
  manifests: readonly AppModule[],
  options: BuildRegistryOptions = {},
): Registry {
  const disabled = options.disabledKeys ?? new Set<string>();
  const seen = new Set<string>();
  const modules: AppModule[] = [];

  for (const manifest of manifests) {
    if (seen.has(manifest.key)) {
      throw new Error(`Duplicate module key "${manifest.key}" in registry`);
    }
    seen.add(manifest.key);
    if (manifest.enabled && !disabled.has(manifest.key)) modules.push(manifest);
  }

  const notificationTypes = new Map<string, NotificationTypeDef>();
  const eventHandlers: Registry["eventHandlers"] = new Map();

  for (const mod of modules) {
    for (const def of mod.notificationTypes ?? []) {
      if (notificationTypes.has(def.type)) {
        throw new Error(`Notification type "${def.type}" declared twice (module "${mod.key}")`);
      }
      notificationTypes.set(def.type, def);
    }
    for (const [type, handler] of Object.entries(mod.eventHandlers ?? {})) {
      const list = eventHandlers.get(type) ?? [];
      list.push({ module: mod.key, handler });
      eventHandlers.set(type, list);
    }
  }

  return {
    modules,
    nav: (space, role) =>
      modules.flatMap((m) => (m.nav[space] ?? []).filter((item) => item.roles.includes(role))),
    notificationTypes,
    eventHandlers,
    widgets: (space) => modules.flatMap((m) => m.dashboardWidgets?.[space] ?? []),
  };
}
