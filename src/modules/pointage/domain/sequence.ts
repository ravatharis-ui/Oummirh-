/**
 * The four pointings of a day, in the only order they may happen.
 *
 * The database enforces this in `clock_event`; the copy here exists so the phone
 * can show a single button saying what to do next, instead of four buttons of
 * which three would be refused.
 */
export const CLOCK_EVENTS = ["clock_in", "break_start", "break_end", "clock_out"] as const;

export type ClockEventType = (typeof CLOCK_EVENTS)[number];

export function isClockEventType(value: string): value is ClockEventType {
  return (CLOCK_EVENTS as readonly string[]).includes(value);
}

export interface ClockAction {
  type: ClockEventType;
  /** What the big button says. */
  label: string;
  /** One line under it, to remove any doubt about what is being recorded. */
  hint: string;
  /** A selfie is taken for the arrival only: it is the one that proves presence. */
  needsPhoto: boolean;
}

const ACTIONS: Record<ClockEventType, ClockAction> = {
  clock_in: {
    type: "clock_in",
    label: "Je commence",
    hint: "Ton arrivée sera enregistrée à l'heure du serveur.",
    needsPhoto: true,
  },
  break_start: {
    type: "break_start",
    label: "Je pars en pause",
    hint: "Ta pause commence maintenant.",
    needsPhoto: false,
  },
  break_end: {
    type: "break_end",
    label: "Je reprends",
    hint: "Ta pause se termine maintenant.",
    needsPhoto: false,
  },
  clock_out: {
    type: "clock_out",
    label: "Je termine",
    hint: "Ta journée sera clôturée.",
    needsPhoto: false,
  },
};

export const CLOCK_EVENT_LABELS: Record<ClockEventType, string> = {
  clock_in: "Arrivée",
  break_start: "Début de pause",
  break_end: "Fin de pause",
  clock_out: "Départ",
};

/**
 * What she may do next, given the last thing she pointed today.
 *
 * `null` means the day is finished. The break is optional throughout: after the
 * arrival, leaving for a break and finishing are both offered, and finishing
 * straight away is a perfectly ordinary day.
 */
export function nextClockAction(last: ClockEventType | null): ClockAction | null {
  if (last === null) return ACTIONS.clock_in;
  if (last === "clock_in") return ACTIONS.break_start;
  if (last === "break_start") return ACTIONS.break_end;
  if (last === "break_end") return ACTIONS.clock_out;
  return null;
}

/** The secondary action, when there is a legitimate choice. */
export function alternateClockAction(last: ClockEventType | null): ClockAction | null {
  if (last === "clock_in") return ACTIONS.clock_out;
  return null;
}

export function clockAction(type: ClockEventType): ClockAction {
  return ACTIONS[type];
}

/** Mirrors the transitions `clock_event` accepts. */
export function isAllowedTransition(last: ClockEventType | null, next: ClockEventType): boolean {
  if (last === null) return next === "clock_in";
  if (last === "clock_in") return next === "break_start" || next === "clock_out";
  if (last === "break_start") return next === "break_end";
  if (last === "break_end") return next === "clock_out";
  return false;
}
