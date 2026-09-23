import { createAdminSupabaseClient } from "@/core/db/admin";
import type { DomainEvent, EventHandler } from "@/core/modules";

/**
 * Handlers of the planning module.
 *
 * This is the whole point of the event bus: congés, remplacements and échanges
 * all end up as days in the planning, and none of them imports this module. They
 * announce what they decided; the planning decides what that looks like on a
 * calendar.
 *
 * Every handler is idempotent. `apply_planning_from_event` keys on
 * `(source, source_ref)`, so replaying an event after a crash rewrites the same
 * rows rather than adding new ones.
 */

interface RangePayload {
  employeeId: string;
  from: string;
  to: string;
  ref: string;
  boutiqueId?: string;
  startTime?: string;
  endTime?: string;
  breakStart?: string;
  breakEnd?: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Reads the payload another module emitted.
 *
 * A malformed payload throws: the dispatcher records the failure and retries,
 * which is what should happen. Silently ignoring it would leave a collaboratrice
 * with an approved leave that never reached her planning.
 */
function readRange(event: DomainEvent, kind: string): RangePayload {
  const payload = asRecord(event.payload);

  const employeeId = asString(payload.employee_id) ?? asString(payload.employeeId);
  const from = asString(payload.start_date) ?? asString(payload.from);
  const to = asString(payload.end_date) ?? asString(payload.to) ?? from;
  const ref = asString(payload.id) ?? asString(payload.request_id) ?? event.id;

  if (!employeeId || !from || !to || !DATE.test(from) || !DATE.test(to)) {
    throw new Error(
      `Événement ${kind} inexploitable : il manque la collaboratrice ou la période (${event.id}).`,
    );
  }

  return {
    employeeId,
    from,
    to,
    ref,
    ...(asString(payload.boutique_id) ? { boutiqueId: asString(payload.boutique_id) } : {}),
    ...(asString(payload.start_time) ? { startTime: asString(payload.start_time) } : {}),
    ...(asString(payload.end_time) ? { endTime: asString(payload.end_time) } : {}),
    ...(asString(payload.break_start) ? { breakStart: asString(payload.break_start) } : {}),
    ...(asString(payload.break_end) ? { breakEnd: asString(payload.break_end) } : {}),
  } as RangePayload;
}

async function applyRange(
  range: RangePayload,
  status: string,
  source: "leave" | "replacement" | "swap",
): Promise<void> {
  const admin = createAdminSupabaseClient();

  const { error } = await admin.rpc("apply_planning_from_event", {
    p_employee_id: range.employeeId,
    p_from: range.from,
    p_to: range.to,
    p_status: status,
    p_source: source,
    p_source_ref: range.ref,
    ...(range.boutiqueId ? { p_boutique_id: range.boutiqueId } : {}),
    ...(range.startTime ? { p_start_time: range.startTime } : {}),
    ...(range.endTime ? { p_end_time: range.endTime } : {}),
    ...(range.breakStart ? { p_break_start: range.breakStart } : {}),
    ...(range.breakEnd ? { p_break_end: range.breakEnd } : {}),
  });

  if (error) {
    throw new Error(`Planning non mis à jour : ${error.message}`);
  }
}

async function clearRange(source: string, ref: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.rpc("clear_planning_from_event", {
    p_source: source,
    p_source_ref: ref,
  });

  if (error) {
    throw new Error(`Planning non libéré : ${error.message}`);
  }
}

/** The auth account behind a collaboratrice, for notifying her. */
async function authUserIdOf(employeeId: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("employees")
    .select("auth_user_id")
    .eq("id", employeeId)
    .maybeSingle();

  return data?.auth_user_id ?? null;
}

export const planningEventHandlers: Record<string, EventHandler> = {
  /** Her planning moved. She is told once, whether one day changed or seven. */
  "planning.entry_changed": async (event, context) => {
    const payload = asRecord(event.payload);
    const employeeId = asString(payload.employee_id);
    if (!employeeId) return;

    const userId = await authUserIdOf(employeeId);
    if (!userId) return;

    await context.notify(userId, "planning.entry_changed", event.payload);
  },

  "conges.request_approved": async (event) => {
    await applyRange(readRange(event, "congé approuvé"), "leave", "leave");
  },

  "conges.request_cancelled": async (event) => {
    const payload = asRecord(event.payload);
    const ref = asString(payload.id) ?? asString(payload.request_id);
    if (!ref) return;
    await clearRange("leave", ref);
  },

  "remplacements.created": async (event) => {
    await applyRange(readRange(event, "remplacement"), "replacement", "replacement");
  },

  "remplacements.cancelled": async (event) => {
    const payload = asRecord(event.payload);
    const ref = asString(payload.id);
    if (!ref) return;
    await clearRange("replacement", ref);
  },

  /**
   * Un échange validé ne pose pas des journées : il en **échange** deux. Ce que
   * la demandeuse faisait ce jour-là, sa collègue le fera, et réciproquement.
   * `apply_planning_swap` repart des deux lignes d'origine, donc rejouer
   * l'événement ne réinverse pas l'échange.
   */
  "swaps.approved": async (event) => {
    const payload = asRecord(event.payload);

    const swapId = asString(payload.id) ?? event.id;
    const requesterId = asString(payload.requester_id);
    const requesterDate = asString(payload.requester_date);
    const partnerId = asString(payload.partner_id);
    const partnerDate = asString(payload.partner_date);

    if (!requesterId || !requesterDate || !partnerId || !partnerDate) {
      throw new Error(`Événement d'échange inexploitable : il manque une journée (${event.id}).`);
    }

    const admin = createAdminSupabaseClient();
    const { error } = await admin.rpc("apply_planning_swap", {
      p_swap_id: swapId,
      p_requester_id: requesterId,
      p_requester_date: requesterDate,
      p_partner_id: partnerId,
      p_partner_date: partnerDate,
    });

    if (error) {
      throw new Error(`Échange non appliqué au planning : ${error.message}`);
    }
  },

  /**
   * Une récupération accordée décale une journée : elle commence plus tard, ou
   * elle finit plus tôt. Le module heures a écrit le débit, le planning écrit
   * l'horaire — et la fonction repart de l'horaire d'origine, donc un rejeu ne
   * décale pas deux fois.
   */
  "heures.recovery_approved": async (event) => {
    const payload = asRecord(event.payload);

    const employeeId = asString(payload.employee_id);
    const date = asString(payload.date);
    const mode = asString(payload.mode);
    const ref = asString(payload.id) ?? event.id;
    const minutes = typeof payload.minutes === "number" ? payload.minutes : null;

    if (!employeeId || !date || !mode || minutes === null) {
      throw new Error(
        `Événement de récupération inexploitable : il manque la journée ou la durée (${event.id}).`,
      );
    }

    const admin = createAdminSupabaseClient();
    const { error } = await admin.rpc("apply_planning_recovery", {
      p_employee_id: employeeId,
      p_date: date,
      p_mode: mode,
      p_minutes: minutes,
      p_source_ref: ref,
    });

    if (error) {
      throw new Error(`Planning non ajusté : ${error.message}`);
    }
  },
};
