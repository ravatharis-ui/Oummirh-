/**
 * Public API of the `planning` module.
 *
 * Nothing else inside this folder may be imported from outside it, which ESLint
 * enforces. Other modules never import this file either: they announce what they
 * decided, and the handlers here react.
 */
export { planningModule } from "./manifest";

export {
  PLANNING_STATUSES,
  PLANNING_STATUS_META,
  QUICK_PRESETS,
  isPlanningStatus,
  isProtectedSource,
  statusMeta,
  type PlanningStatus,
  type PlanningSource,
} from "./domain/status";

export { dayMinutes, weekMinutes, weekBalanceMinutes, type PlannedDay } from "./domain/week";

export {
  applyTemplateSchema,
  duplicateWeekSchema,
  planningEntrySchema,
  type PlanningEntryInput,
} from "./schemas";

export type { PlanningEntry, PlanningRow, PlanningWeek, PresentColleague } from "./types";

export {
  getMyWeek,
  getPlanningTemplate,
  getPlanningWeek,
  getPresence,
  type TemplateDay,
} from "./server/queries";
export {
  applyTemplate,
  clearPlanningEntry,
  clearTemplateDay,
  duplicateWeek,
  savePlanningEntry,
  saveTemplateDay,
} from "./server/actions";

export { PlanningGrid } from "./ui/admin/planning-grid";
export { WeekToolbar } from "./ui/admin/week-toolbar";
export { TemplateDialog } from "./ui/admin/template-dialog";
export { PrintWeek } from "./ui/admin/print-week";
export { MyWeek } from "./ui/collab/my-week";
export { PresenceToday } from "./ui/collab/presence-today";
