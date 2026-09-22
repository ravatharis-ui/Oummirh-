import "server-only";

import { buildRegistry, type Registry } from "@/core/modules";
import { getDisabledModuleKeys } from "@/core/settings";

import { ALL_MODULES } from "./modules";

/**
 * The active module registry for this request.
 *
 * Layouts and dashboards read menus, widgets, notification types and event routing
 * from here and from nowhere else, which is what lets a new module appear without
 * touching any existing file.
 */
export async function getRegistry(): Promise<Registry> {
  return buildRegistry(ALL_MODULES, { disabledKeys: await getDisabledModuleKeys() });
}
