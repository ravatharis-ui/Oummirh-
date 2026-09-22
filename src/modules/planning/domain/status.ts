import type { TimeString } from "@/core/time";

/**
 * The seven things a day can be.
 *
 * The list is closed on purpose and matches the `check` constraint on
 * `planning_entries.status`: a status the database refuses must not be offerable
 * in the interface.
 */
export const PLANNING_STATUSES = [
  "work",
  "replacement",
  "school",
  "rest",
  "leave",
  "sick",
  "other",
] as const;

export type PlanningStatus = (typeof PLANNING_STATUSES)[number];

export interface PlanningStatusMeta {
  label: string;
  short: string;
  /** Tailwind classes for the cell. Colour alone never carries the meaning. */
  cell: string;
  /** Whether hours are expected. Mirrors the database constraint. */
  needsHours: boolean;
  /** Whether the day counts towards the week total. */
  counted: boolean;
}

export const PLANNING_STATUS_META: Record<PlanningStatus, PlanningStatusMeta> = {
  work: {
    label: "Travail",
    short: "Travail",
    cell: "bg-emerald-50 text-emerald-900 border-emerald-200",
    needsHours: true,
    counted: true,
  },
  replacement: {
    label: "Remplacement",
    short: "Rempl.",
    cell: "bg-sky-50 text-sky-900 border-sky-200",
    needsHours: true,
    counted: true,
  },
  school: {
    label: "École",
    short: "École",
    cell: "bg-purple-50 text-purple-900 border-purple-200",
    needsHours: false,
    counted: false,
  },
  rest: {
    label: "Repos",
    short: "Repos",
    cell: "bg-slate-50 text-slate-600 border-slate-200",
    needsHours: false,
    counted: false,
  },
  leave: {
    label: "Congé",
    short: "Congé",
    cell: "bg-amber-50 text-amber-900 border-amber-200",
    needsHours: false,
    counted: false,
  },
  sick: {
    label: "Maladie",
    short: "Maladie",
    cell: "bg-rose-50 text-rose-900 border-rose-200",
    needsHours: false,
    counted: false,
  },
  other: {
    label: "Autre",
    short: "Autre",
    cell: "bg-neutral-50 text-neutral-700 border-neutral-200",
    needsHours: false,
    counted: false,
  },
};

export function isPlanningStatus(value: string): value is PlanningStatus {
  return (PLANNING_STATUSES as readonly string[]).includes(value);
}

export function statusMeta(status: string): PlanningStatusMeta {
  return isPlanningStatus(status) ? PLANNING_STATUS_META[status] : PLANNING_STATUS_META.other;
}

/** Where a planning row came from. A bulk operation never overwrites the last three. */
export const PLANNING_SOURCES = ["manual", "template", "leave", "replacement", "swap"] as const;
export type PlanningSource = (typeof PLANNING_SOURCES)[number];

const PROTECTED_SOURCES: readonly string[] = ["leave", "replacement", "swap"];

/**
 * Mirrors `planning_protected_sources()` in SQL.
 *
 * The database is what actually enforces this; the copy here only exists so the
 * interface can grey out a cell instead of letting someone click a button that
 * would silently do nothing.
 */
export function isProtectedSource(source: string): boolean {
  return PROTECTED_SOURCES.includes(source);
}

/** Quick buttons of the side panel, in the order the direction uses them. */
export interface QuickPreset {
  key: string;
  label: string;
  status: PlanningStatus;
  start?: TimeString;
  end?: TimeString;
  breakStart?: TimeString;
  breakEnd?: TimeString;
}

export const QUICK_PRESETS: readonly QuickPreset[] = [
  {
    key: "standard",
    label: "Journée standard",
    status: "work",
    start: "09:00",
    end: "17:30",
    breakStart: "12:30",
    breakEnd: "14:00",
  },
  { key: "morning", label: "Matin", status: "work", start: "09:00", end: "13:00" },
  { key: "afternoon", label: "Après-midi", status: "work", start: "13:30", end: "19:00" },
  { key: "rest", label: "Repos", status: "rest" },
  { key: "school", label: "École", status: "school" },
];
