import type { AppModule } from "@/core/modules";
import { demoModule } from "@/modules/demo";

/**
 * Active module manifests.
 *
 * This is the single file to touch when adding a module: create
 * `src/modules/<key>/`, export its manifest from that folder's `index.ts`, and add
 * it to the list below. Menus, dashboard widgets, notification types and event
 * routing are all derived from it by `buildRegistry`.
 */
export const ALL_MODULES: readonly AppModule[] = [demoModule];
