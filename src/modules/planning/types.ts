import type { DateString, TimeString } from "@/core/time";

/** One day of one collaboratrice, as every screen of this module reads it. */
export interface PlanningEntry {
  id: string;
  employeeId: string;
  boutiqueId: string;
  date: DateString;
  status: string;
  startTime: TimeString | null;
  endTime: TimeString | null;
  breakStart: TimeString | null;
  breakEnd: TimeString | null;
  note: string | null;
  source: string;
}

/** A row of the weekly matrix: one collaboratrice and her seven days. */
export interface PlanningRow {
  employeeId: string;
  displayName: string;
  boutiqueId: string;
  boutiqueName: string;
  weeklyContractHours: number | null;
  /** Keyed by `YYYY-MM-DD`; a missing key is an empty day. */
  days: Record<DateString, PlanningEntry>;
  plannedMinutes: number;
  balanceMinutes: number | null;
}

export interface PlanningWeek {
  weekStart: DateString;
  dates: DateString[];
  rows: PlanningRow[];
  boutiques: { id: string; name: string }[];
  boutiqueId: string | null;
}

/** A colleague on the floor the same day, seen from the collaboratrice space. */
export interface PresentColleague {
  employeeId: string;
  displayName: string;
  startTime: TimeString | null;
  endTime: TimeString | null;
}

export type { ActionResult } from "@/core/actions";
