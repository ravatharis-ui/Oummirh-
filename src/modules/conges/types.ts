import type { DateString } from "@/core/time";

import type { HalfDay, LeaveStatus } from "./domain/count";

export interface LeaveRequestRow {
  id: string;
  employeeId: string;
  displayName: string;
  startDate: DateString;
  endDate: DateString;
  startHalf: HalfDay | null;
  endHalf: HalfDay | null;
  days: number;
  status: LeaveStatus;
  reason: string | null;
  adminComment: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface LeaveMovement {
  id: string;
  kind: string;
  days: number;
  occurredOn: DateString;
  note: string | null;
}

/** Ce que l'écran de la collaboratrice montre en une fois. */
export interface MyLeaveState {
  employeeId: string;
  periodStart: DateString;
  balance: number;
  requests: LeaveRequestRow[];
  movements: LeaveMovement[];
  holidays: DateString[];
  nonWorkingDays: DateString[];
}

export interface LeaveOverlap {
  employeeId: string;
  displayName: string;
  startDate: DateString;
  endDate: DateString;
}

/** Une ligne du tableau des soldes, côté direction. */
export interface LeaveBalanceRow {
  employeeId: string;
  displayName: string;
  boutiqueName: string;
  balance: number;
}

export type { ActionResult } from "@/core/actions";
