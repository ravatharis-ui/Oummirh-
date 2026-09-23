import type { DateString } from "@/core/time";

import type { HoursDetailRow } from "./domain/detail";
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
  /** Le même compteur, mouvement par mouvement, tel qu'il s'affiche. */
  detail: HoursDetailRow[];
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

/** Le compteur d'une collaboratrice, vu par la direction. */
export interface EmployeeHoursDetail {
  employeeId: string;
  displayName: string;
  boutiqueName: string;
  balanceMinutes: number;
  rows: HoursDetailRow[];
}

export type { ActionResult } from "@/core/actions";
