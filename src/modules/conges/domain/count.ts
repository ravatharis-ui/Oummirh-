import { eachDateInRange, isoWeekday, type DateString } from "@/core/time";

import { DEFAULT_LEAVE_RULES, type LeaveRules } from "./period";

/** Which half of the first or last day is actually taken. */
export type HalfDay = "am" | "pm";

export interface CountInput {
  from: DateString;
  to: DateString;
  /** `pm` on the first day: she leaves after lunch, so that day counts a half. */
  startHalf?: HalfDay | null;
  /** `am` on the last day: she is back after lunch. */
  endHalf?: HalfDay | null;
  /** Public holidays in Réunion, as `YYYY-MM-DD`. The 20 December is one of them. */
  holidays: ReadonlySet<DateString> | readonly DateString[];
  /** Days already planned as rest or school. Taking leave on them costs nothing. */
  nonWorkingDays: ReadonlySet<DateString> | readonly DateString[];
  rules?: LeaveRules;
}

function asSet(value: ReadonlySet<DateString> | readonly DateString[]): ReadonlySet<DateString> {
  return value instanceof Set ? value : new Set(value);
}

/**
 * Days a leave request costs.
 *
 * This mirrors `count_leave_days()` in SQL, which remains the authority: the
 * server recounts at submission and again at approval. What lives here is the
 * preview the collaboratrice sees while she picks her dates — and the reason it
 * is a pure function is so that every rule below can be pinned by a test rather
 * than discovered by someone whose balance came out wrong.
 *
 * Never counted: days outside the working week (Saturday counts in `ouvrables`,
 * not in `ouvres`), public holidays, and days already planned as rest or school.
 */
export function countLeaveDays(input: CountInput): number {
  const rules = input.rules ?? DEFAULT_LEAVE_RULES;
  const lastWeekday = rules.mode === "ouvres" ? 5 : 6;

  const holidays = asSet(input.holidays);
  const nonWorking = asSet(input.nonWorkingDays);

  const counts = (date: DateString): boolean =>
    isoWeekday(date) <= lastWeekday && !holidays.has(date) && !nonWorking.has(date);

  const dates = eachDateInRange(input.from, input.to);
  let total = dates.filter(counts).length;

  if (total === 0) return 0;

  // A single day can only ever lose one half.
  if (input.from === input.to) {
    if ((input.startHalf || input.endHalf) && counts(input.from)) total -= 0.5;
    return Math.max(total, 0);
  }

  if (input.startHalf === "pm" && counts(input.from)) total -= 0.5;
  if (input.endHalf === "am" && counts(input.to)) total -= 0.5;

  return Math.max(total, 0);
}

/** "3 jours", "1 jour", "2,5 jours" — le format français, virgule comprise. */
export function formatLeaveDays(days: number): string {
  const rounded = Math.round(days * 100) / 100;
  const text = rounded.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  return `${text} ${Math.abs(rounded) <= 1 ? "jour" : "jours"}`;
}

/** Les statuts d'une demande, et comment on les nomme à l'écran. */
export const LEAVE_STATUS_LABELS = {
  pending: "En attente",
  approved: "Validé",
  refused: "Refusé",
  cancelled: "Annulé",
} as const;

export type LeaveStatus = keyof typeof LEAVE_STATUS_LABELS;

export function isLeaveStatus(value: string): value is LeaveStatus {
  return value in LEAVE_STATUS_LABELS;
}
