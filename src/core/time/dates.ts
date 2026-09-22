import { addDays as addDaysToDate, formatDistanceStrict } from "date-fns";
import { fr } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

import { REUNION_TZ, type DateString, type IsoWeekday } from "./constants";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Calendar dates are handled as `YYYY-MM-DD` strings rather than `Date` objects.
 * A planning entry for "21 septembre" means that day in Réunion whatever the server
 * clock says, and a string cannot silently drift by a timezone offset.
 *
 * Internally each date string is anchored to 12:00 UTC. Noon keeps the calendar day
 * stable under every real-world offset (UTC-12 … UTC+14), so arithmetic never slips
 * a day. Formatting always pins the timezone explicitly for the same reason.
 */
export function parseDateString(date: DateString): Date {
  const match = DATE_PATTERN.exec(date);
  if (!match) {
    throw new Error(`Date invalide : "${date}". Format attendu : AAAA-MM-JJ.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const anchored = new Date(Date.UTC(year, month - 1, day, 12));

  // Rejects impossible days such as 2026-02-31, which Date would roll over silently.
  if (
    anchored.getUTCFullYear() !== year ||
    anchored.getUTCMonth() !== month - 1 ||
    anchored.getUTCDate() !== day
  ) {
    throw new Error(`Date inexistante : "${date}".`);
  }

  return anchored;
}

/** Formats an anchored date back to `YYYY-MM-DD`. */
export function toDateString(anchored: Date): DateString {
  return formatInTimeZone(anchored, "UTC", "yyyy-MM-dd");
}

/** The calendar day an instant falls on, in Réunion. */
export function toReunionDateString(instant: Date): DateString {
  return formatInTimeZone(instant, REUNION_TZ, "yyyy-MM-dd");
}

/** The wall-clock time an instant falls on, in Réunion (`HH:MM`). */
export function toReunionTimeString(instant: Date): string {
  return formatInTimeZone(instant, REUNION_TZ, "HH:mm");
}

/** Today in Réunion. Pass `now` in tests rather than mocking the clock. */
export function todayInReunion(now: Date = new Date()): DateString {
  return toReunionDateString(now);
}

export function addDays(date: DateString, amount: number): DateString {
  return toDateString(addDaysToDate(parseDateString(date), amount));
}

/** 1 = Monday … 7 = Sunday, matching `employees.work_days`. */
export function isoWeekday(date: DateString): IsoWeekday {
  const day = parseDateString(date).getUTCDay();
  return (day === 0 ? 7 : day) as IsoWeekday;
}

/** The Monday of the week containing `date`. */
export function startOfIsoWeek(date: DateString): DateString {
  return addDays(date, -(isoWeekday(date) - 1));
}

/** The seven days of the week containing `date`, Monday first. */
export function isoWeekDates(date: DateString): DateString[] {
  const monday = startOfIsoWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** Every day from `start` to `end`, inclusive. */
export function eachDateInRange(start: DateString, end: DateString): DateString[] {
  if (parseDateString(end) < parseDateString(start)) {
    throw new Error(
      `Période invalide : la date de fin (${end}) précède la date de début (${start}).`,
    );
  }

  const dates: DateString[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

/** Saturday or Sunday. */
export function isWeekend(date: DateString): boolean {
  return isoWeekday(date) >= 6;
}

/** "lundi 21 septembre" */
export function formatFrDate(date: DateString): string {
  return formatInTimeZone(parseDateString(date), "UTC", "EEEE d MMMM", { locale: fr });
}

/** "lundi 21 septembre 2026" */
export function formatFrDateWithYear(date: DateString): string {
  return formatInTimeZone(parseDateString(date), "UTC", "EEEE d MMMM yyyy", { locale: fr });
}

/** "21/09/2026" */
export function formatFrDateShort(date: DateString): string {
  return formatInTimeZone(parseDateString(date), "UTC", "dd/MM/yyyy");
}

/** "septembre 2026" */
export function formatFrMonth(date: DateString): string {
  return formatInTimeZone(parseDateString(date), "UTC", "MMMM yyyy", { locale: fr });
}

/**
 * "il y a 5 minutes", "il y a 2 jours".
 *
 * Takes the instant as an ISO string, the shape Postgres returns, and `now` as a
 * parameter so tests never depend on the wall clock.
 */
export function formatRelativeFr(instant: string, now: Date = new Date()): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Instant invalide : "${instant}".`);
  }

  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 0) return "à l'instant";
  if (seconds < 60) return "à l'instant";

  // `formatDistanceStrict` and not `formatDistanceToNowStrict`: the latter reads
  // the real clock and would quietly ignore the `now` passed in, which is exactly
  // what a test would then fail to pin down.
  return formatDistanceStrict(date, now, {
    locale: fr,
    addSuffix: true,
    roundingMethod: "floor",
  });
}
