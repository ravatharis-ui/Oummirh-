/** Réunion is UTC+4 all year round: no daylight saving, so no ambiguous local times. */
export const REUNION_TZ = "Indian/Reunion";

/** A calendar day in `YYYY-MM-DD` form, always interpreted in Réunion local time. */
export type DateString = string;

/** A wall-clock time in `HH:MM` form (24 hour). */
export type TimeString = string;

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
