import type { AppModule } from "@/core/modules";
import { demoModule } from "@/modules/demo";
import { congesModule } from "@/modules/conges";
import { employeesModule } from "@/modules/employees";
import { heuresModule } from "@/modules/heures";
import { planningModule } from "@/modules/planning";
import { remplacementsModule } from "@/modules/remplacements";
import { swapsModule } from "@/modules/swaps";
import { pointageModule } from "@/modules/pointage";

/**
 * Active module manifests.
 *
 * This is the single file to touch when adding a module: create
 * `src/modules/<key>/`, export its manifest from that folder's `index.ts`, and add
 * it to the list below. Menus, dashboard widgets, notification types and event
 * routing are all derived from it by `buildRegistry`.
 */
export const ALL_MODULES: readonly AppModule[] = [
  employeesModule,
  planningModule,
  pointageModule,
  congesModule,
  heuresModule,
  remplacementsModule,
  swapsModule,
  demoModule,
];
