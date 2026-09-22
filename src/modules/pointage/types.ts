import type { DateString, TimeString } from "@/core/time";

import type { ClockEventType } from "./domain/sequence";

export interface ClockRecord {
  id: string;
  employeeId: string;
  eventType: ClockEventType;
  occurredAt: string;
  localDate: DateString;
  plannedTime: TimeString | null;
  deltaMinutes: number | null;
  isCorrection: boolean;
  correctionReason: string | null;
  photoPath: string | null;
}

/** What the collaboratrice's pointing screen needs to decide what to show. */
export interface ClockState {
  employeeId: string;
  localDate: DateString;
  events: ClockRecord[];
  last: ClockEventType | null;
  /** From today's planning, when there is one. */
  plannedStatus: string | null;
  plannedStart: TimeString | null;
  plannedEnd: TimeString | null;
  selfieRequired: boolean;
  toleranceMinutes: number;
}

/** One line of the direction's live board. */
export interface PresenceRow {
  employeeId: string;
  displayName: string;
  boutiqueName: string;
  plannedStatus: string | null;
  plannedStart: TimeString | null;
  plannedEnd: TimeString | null;
  last: ClockEventType | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  arrivalDeltaMinutes: number | null;
  workedMinutes: number | null;
}

export interface HistoryRow {
  employeeId: string;
  displayName: string;
  localDate: DateString;
  clockInAt: string | null;
  clockOutAt: string | null;
  breakStartAt: string | null;
  breakEndAt: string | null;
  arrivalDeltaMinutes: number | null;
  workedMinutes: number | null;
  hasCorrection: boolean;
}

export type { ActionResult } from "@/core/actions";
