/**
 * API publique du module `heures`.
 *
 * Les autres modules n'importent jamais ce fichier : ils écoutent `heures.*`.
 */
export { heuresModule } from "./manifest";

export {
  availableMinutes,
  balanceTone,
  BALANCE_TONE_CLASS,
  checkRecoveryRequest,
  formatBalance,
  isRecoveryMode,
  isRecoveryStatus,
  offeredDurations,
  RECOVERY_MODES,
  RECOVERY_MODE_LABELS,
  RECOVERY_SHORTCUTS,
  RECOVERY_STATUS_LABELS,
  RECOVERY_STEP_MINUTES,
  type RecoveryMode,
  type RecoveryStatus,
} from "./domain/recovery";

export {
  cumulativeMinutes,
  monthlyTotals,
  toCsv,
  type HoursMovement,
  type MonthlyTotals,
} from "./domain/monthly";

export {
  hoursAdjustmentSchema,
  recoveryRequestSchema,
  type HoursAdjustmentInput,
  type RecoveryRequestInput,
} from "./schemas";

export type { HoursMonthRow, HoursMovementRow, MyHoursState, RecoveryRequestRow } from "./types";

export { getHoursMonth, getMyHoursState, getRecoveryRequests } from "./server/queries";
export { adjustHoursBalance, decideRecovery, requestRecovery } from "./server/actions";

export { MyHours } from "./ui/collab/my-hours";
export { HoursTable } from "./ui/admin/hours-table";
export { RecoveryList } from "./ui/admin/recovery-list";
