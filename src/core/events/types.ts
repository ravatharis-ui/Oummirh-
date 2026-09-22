import type { DomainEvent } from "@/core/modules";

/** What one pass of the dispatcher did. Returned to the caller and logged. */
export interface DispatchResult {
  claimed: number;
  processed: number;
  failed: number;
}

export interface DispatchFailure {
  eventId: string;
  type: string;
  message: string;
  /** True once the event has used up its attempts and will not be retried. */
  abandoned: boolean;
}

export type { DomainEvent };
