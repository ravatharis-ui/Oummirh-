import type { DateString } from "@/core/time";

import type { RecoveryMode, RecoveryStatus } from "./domain/recovery";

export interface RecoveryRequestRow {
  id: string;
  employeeId: string;
  displayName: string;
  date: DateString;
  mode: RecoveryMode;
  minutes: number;
  status: RecoveryStatus;
  adminComment: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface HoursMovementRow {
  id: string;
  kind: string;
  minutes: number;
  localDate: DateString;
  note: string | null;
}

/** L'écran de la collaboratrice, en une fois. */
export interface MyHoursState {
  employeeId: string;
  balanceMinutes: number;
  pendingMinutes: number;
  availableMinutes: number;
  movements: HoursMovementRow[];
  requests: RecoveryRequestRow[];
  /** Ses journées travaillées à venir, seules éligibles à une récupération. */
  eligibleDays: { date: DateString; startTime: string; endTime: string }[];
}

/** Une ligne du tableau mensuel de la direction. */
export interface HoursMonthRow {
  employeeId: string;
  displayName: string;
  boutiqueName: string;
  contractMinutes: number | null;
  plannedMinutes: number;
  workedMinutes: number;
  monthMinutes: number;
  balanceMinutes: number;
}

export type { ActionResult } from "@/core/actions";
