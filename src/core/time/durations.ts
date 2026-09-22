import type { TimeString } from "./constants";

const TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Minutes since midnight. Accepts `HH:MM` and Postgres' `HH:MM:SS`, so values read
 * straight from a `time` column need no massaging.
 */
export function parseTimeToMinutes(time: TimeString): number {
  const match = TIME_PATTERN.exec(time);
  if (!match) {
    throw new Error(`Heure invalide : "${time}". Format attendu : HH:MM.`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new Error(`Heure inexistante : "${time}".`);
  }

  return hours * 60 + minutes;
}

/** 570 → "09:30" */
export function minutesToTimeString(minutes: number): TimeString {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 24 * 60) {
    throw new Error(
      `Durée invalide : ${minutes} minutes ne correspond pas à une heure de la journée.`,
    );
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** Normalises `09:30:00` to `09:30` for display. */
export function formatTime(time: TimeString): TimeString {
  return minutesToTimeString(parseTimeToMinutes(time));
}

/**
 * Human duration in French: `7 h 30`, `45 min`, `-1 h 15`.
 * Used for worked time, planned time and hour balances alike.
 */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes)) {
    throw new Error(`Durée invalide : ${minutes}.`);
  }

  const rounded = Math.round(minutes);
  const sign = rounded < 0 ? "-" : "";
  const absolute = Math.abs(rounded);
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;

  if (hours === 0 && rest === 0) return "0 h";
  if (hours === 0) return `${sign}${rest} min`;
  if (rest === 0) return `${sign}${hours} h`;
  return `${sign}${hours} h ${String(rest).padStart(2, "0")}`;
}

/** Same as `formatDuration`, with an explicit `+` for credits (hour balances). */
export function formatSignedDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded > 0) return `+${formatDuration(rounded)}`;
  return formatDuration(rounded);
}

export interface DaySchedule {
  start: TimeString;
  end: TimeString;
  breakStart?: TimeString | null;
  breakEnd?: TimeString | null;
}

/**
 * Minutes actually worked in a day, lunch break deducted.
 *
 * Only the part of the break that overlaps the shift is deducted, so a break
 * recorded outside the working window cannot create negative time. The default
 * day (09:00–17:30 with 12:30–14:00 off) yields 420 minutes, i.e. 7 h.
 */
export function workedMinutes({ start, end, breakStart, breakEnd }: DaySchedule): number {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);

  if (endMinutes <= startMinutes) {
    throw new Error(
      `Horaires invalides : la fin (${formatTime(end)}) doit être après le début (${formatTime(start)}).`,
    );
  }

  let total = endMinutes - startMinutes;

  if (breakStart && breakEnd) {
    const breakStartMinutes = parseTimeToMinutes(breakStart);
    const breakEndMinutes = parseTimeToMinutes(breakEnd);

    if (breakEndMinutes <= breakStartMinutes) {
      throw new Error(
        `Pause invalide : la fin (${formatTime(breakEnd)}) doit être après le début (${formatTime(breakStart)}).`,
      );
    }

    const overlap =
      Math.min(endMinutes, breakEndMinutes) - Math.max(startMinutes, breakStartMinutes);
    if (overlap > 0) total -= overlap;
  }

  return total;
}
