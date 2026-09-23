import type { DateString, TimeString } from "@/core/time";

import type { Availability, ReplacementStatus } from "./domain/availability";

/** Une candidate, avec ce qu'on sait d'elle pour la journée visée. */
export interface Candidate {
  employeeId: string;
  displayName: string;
  homeBoutique: string;
  availability: Availability;
  plannedStatus: string | null;
  plannedStart: TimeString | null;
  plannedEnd: TimeString | null;
  plannedShop: string | null;
}

export interface ReplacementRow {
  id: string;
  employeeId: string;
  displayName: string;
  boutiqueId: string;
  boutiqueName: string;
  date: DateString;
  startTime: TimeString;
  endTime: TimeString;
  breakStart: TimeString | null;
  breakEnd: TimeString | null;
  note: string | null;
  status: ReplacementStatus;
  createdAt: string;
}

export type { ActionResult } from "@/core/actions";
