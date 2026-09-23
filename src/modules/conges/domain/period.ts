import { parseDateString, toDateString, type DateString } from "@/core/time";

/** Règles d'acquisition, telles que `settings.leave_rules` les porte. */
export interface LeaveRules {
  /** `ouvrables` : lundi → samedi, 30 j/an. `ouvres` : lundi → vendredi, 25 j/an. */
  mode: "ouvrables" | "ouvres";
  daysPerMonth: number;
  periodStartMonth: number;
  periodStartDay: number;
  carryOver: boolean;
}

export const DEFAULT_LEAVE_RULES: LeaveRules = {
  mode: "ouvrables",
  daysPerMonth: 2.5,
  periodStartMonth: 6,
  periodStartDay: 1,
  carryOver: true,
};

/**
 * The 1 June that opens the period containing `date`.
 *
 * Mirrors `leave_period_start()` in SQL. The database is the authority; this
 * exists so a screen can label a period without a round trip.
 */
export function periodStart(date: DateString, rules: LeaveRules = DEFAULT_LEAVE_RULES): DateString {
  const anchored = parseDateString(date);
  const year = anchored.getUTCFullYear();

  const candidate = new Date(Date.UTC(year, rules.periodStartMonth - 1, rules.periodStartDay, 12));

  if (anchored >= candidate) return toDateString(candidate);

  return toDateString(
    new Date(Date.UTC(year - 1, rules.periodStartMonth - 1, rules.periodStartDay, 12)),
  );
}

/**
 * La période précédente, ou la suivante.
 *
 * Décaler d'un an suffit : la période s'ouvre au même jour de mois chaque
 * année. Écrit ici plutôt que dans l'écran pour que le libellé et le décalage
 * restent d'accord.
 */
export function shiftPeriod(start: DateString, years: number): DateString {
  const anchored = parseDateString(start);
  return toDateString(
    new Date(
      Date.UTC(
        anchored.getUTCFullYear() + years,
        anchored.getUTCMonth(),
        anchored.getUTCDate(),
        12,
      ),
    ),
  );
}

/** La fin exclusive d'une période : le 1er juin suivant. */
export function periodEnd(start: DateString): DateString {
  return shiftPeriod(start, 1);
}

/** "juin 2026 → mai 2027" */
export function periodLabel(start: DateString): string {
  const anchored = parseDateString(start);
  const endYear = anchored.getUTCFullYear() + 1;
  return `juin ${anchored.getUTCFullYear()} → mai ${endYear}`;
}

/**
 * Days earned for a month, prorated when the collaboratrice was hired during it.
 *
 * Someone hired on the 28th must not earn the same as someone present since the
 * 1st. Mirrors `accrue_monthly_leave()`.
 */
export function monthlyAccrual(
  monthStart: DateString,
  hireDate: DateString | null,
  rules: LeaveRules = DEFAULT_LEAVE_RULES,
): number {
  const start = parseDateString(monthStart);
  const daysInMonth = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();

  if (!hireDate) return rules.daysPerMonth;

  const hire = parseDateString(hireDate);
  if (hire <= start) return rules.daysPerMonth;

  const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), daysInMonth, 12));
  if (hire > monthEnd) return 0;

  const remaining = daysInMonth - hire.getUTCDate() + 1;
  return Math.round(((rules.daysPerMonth * remaining) / daysInMonth) * 100) / 100;
}
