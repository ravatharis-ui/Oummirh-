/**
 * API publique du module `conges`.
 *
 * Les autres modules n'importent jamais ce fichier : ils écoutent les
 * événements `conges.*` et en tirent leurs propres conclusions.
 */
export { congesModule } from "./manifest";

export { leaveCounters, type LeaveCounters } from "./domain/counters";

export {
  countLeaveDays,
  formatLeaveDays,
  isLeaveStatus,
  LEAVE_STATUS_LABELS,
  type CountInput,
  type HalfDay,
  type LeaveStatus,
} from "./domain/count";

export {
  DEFAULT_LEAVE_RULES,
  monthlyAccrual,
  periodLabel,
  periodStart,
  type LeaveRules,
} from "./domain/period";

export {
  leaveAdjustmentSchema,
  leaveRequestSchema,
  type LeaveAdjustmentInput,
  type LeaveRequestInput,
} from "./schemas";

export type {
  LeaveBalanceRow,
  LeaveMovement,
  LeaveOverlap,
  LeaveRequestRow,
  MyLeaveState,
} from "./types";

export {
  getAbsenceCalendar,
  getLeaveBalances,
  getLeaveOverlaps,
  getLeaveRequests,
  getMyLeaveState,
} from "./server/queries";

export {
  adjustLeaveBalance,
  cancelLeaveRequest,
  decideLeaveRequest,
  submitLeaveRequest,
} from "./server/actions";

export { LeaveForm } from "./ui/collab/leave-form";
export { MyLeave } from "./ui/collab/my-leave";
export { RequestList } from "./ui/admin/request-list";
export { BalanceTable } from "./ui/admin/balance-table";
export { AbsenceCalendar } from "./ui/admin/absence-calendar";
