import type { DateString, TimeString } from "@/core/time";

import type { SwapStatus } from "./domain/status";

export interface SwapRow {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterDate: DateString;
  partnerId: string;
  partnerName: string;
  partnerDate: DateString;
  message: string | null;
  status: SwapStatus;
  adminComment: string | null;
  createdAt: string;
}

/** Une journée proposable, avec ce qu'elle contient. */
export interface SwappableDay {
  date: DateString;
  status: string;
  startTime: TimeString | null;
  endTime: TimeString | null;
}

/** Une collègue, et les journées qu'on pourrait lui demander. */
export interface Colleague {
  employeeId: string;
  displayName: string;
  boutiqueName: string;
  sameBoutique: boolean;
  days: SwappableDay[];
}

export interface MySwapsState {
  employeeId: string;
  myDays: SwappableDay[];
  colleagues: Colleague[];
  /** Les demandes que j'ai faites. */
  sent: SwapRow[];
  /** Les demandes qu'on m'a faites. */
  received: SwapRow[];
}

export type { ActionResult } from "@/core/actions";
