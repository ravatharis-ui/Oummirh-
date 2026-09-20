import type { AppModule } from "@/core/modules";

/**
 * Active module manifests. This is the single file to touch when adding a module:
 * `import { congesModule } from "@/modules/conges"; ... ALL_MODULES = [congesModule, ...]`.
 * Layouts and dashboards read everything else from `buildRegistry(ALL_MODULES)`.
 */
export const ALL_MODULES: readonly AppModule[] = [];
