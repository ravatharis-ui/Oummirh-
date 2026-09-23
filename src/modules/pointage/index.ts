/**
 * Public API of the `pointage` module.
 *
 * Other modules never import this file: they listen to `pointage.clock_recorded`
 * and draw their own conclusions from it.
 */
export { pointageModule } from "./manifest";

export {
  CLOCK_EVENTS,
  CLOCK_EVENT_LABELS,
  alternateClockAction,
  clockAction,
  isAllowedTransition,
  isClockEventType,
  nextClockAction,
  type ClockAction,
  type ClockEventType,
} from "./domain/sequence";

export { DELTA_TONE_CLASS, deltaTone, formatDelta, type DeltaTone } from "./domain/delta";

export {
  correctionSchema,
  historyFiltersSchema,
  photoPathSchema,
  type CorrectionInput,
  type HistoryFilters,
} from "./schemas";

export type { ClockRecord, ClockState, HistoryRow, PresenceRow } from "./types";

export { getClockHistory, getClockState, getPresenceBoard, getSelfieUrl } from "./server/queries";
export { correctClock, openSelfie, recordClock } from "./server/actions";

export { ClockScreen } from "./ui/collab/clock-screen";
export { PresenceBoard } from "./ui/admin/presence-board";
export { HistoryTable } from "./ui/admin/history-table";
