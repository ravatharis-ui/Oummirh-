import { workedMinutes, type DateString, type TimeString } from "@/core/time";

import { statusMeta } from "./status";

/** The shape the week maths needs. Deliberately not the database row. */
export interface PlannedDay {
  date: DateString;
  status: string;
  startTime: TimeString | null;
  endTime: TimeString | null;
  breakStart: TimeString | null;
  breakEnd: TimeString | null;
}

/**
 * Minutes a planned day represents.
 *
 * A day without hours is worth nothing, whatever its status: a leave day is not
 * planned work. What it is worth in the leave ledger is the congés module's
 * business, not the planning's.
 */
export function dayMinutes(day: PlannedDay): number {
  if (!statusMeta(day.status).counted) return 0;
  if (!day.startTime || !day.endTime) return 0;

  return workedMinutes({
    start: day.startTime,
    end: day.endTime,
    breakStart: day.breakStart,
    breakEnd: day.breakEnd,
  });
}

export function weekMinutes(days: readonly PlannedDay[]): number {
  return days.reduce((total, day) => total + dayMinutes(day), 0);
}

/**
 * How the planned week compares with the contract.
 *
 * `null` when no contract hours are recorded: showing "-35 h" for someone whose
 * contract we do not know would be an accusation, not information.
 */
export function weekBalanceMinutes(
  days: readonly PlannedDay[],
  weeklyContractHours: number | null,
): number | null {
  if (weeklyContractHours === null) return null;
  return weekMinutes(days) - Math.round(weeklyContractHours * 60);
}
