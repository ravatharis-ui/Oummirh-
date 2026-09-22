import "server-only";

import { requireAdmin, requireEmployee } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";
import { getSettings } from "@/core/settings";
import { addDays, todayInReunion, type DateString } from "@/core/time";

import { isClockEventType, type ClockEventType } from "../domain/sequence";
import type { HistoryFilters } from "../schemas";
import type { ClockRecord, ClockState, HistoryRow, PresenceRow } from "../types";

const CLOCK_COLUMNS =
  "id, employee_id, event_type, occurred_at, local_date, planned_time, delta_minutes, is_correction, correction_reason, photo_path";

interface RawClock {
  id: string;
  employee_id: string;
  event_type: string;
  occurred_at: string;
  local_date: string;
  planned_time: string | null;
  delta_minutes: number | null;
  is_correction: boolean;
  correction_reason: string | null;
  photo_path: string | null;
}

function toRecord(raw: RawClock): ClockRecord | null {
  if (!isClockEventType(raw.event_type)) return null;

  return {
    id: raw.id,
    employeeId: raw.employee_id,
    eventType: raw.event_type,
    occurredAt: raw.occurred_at,
    localDate: raw.local_date,
    plannedTime: raw.planned_time,
    deltaMinutes: raw.delta_minutes,
    isCorrection: raw.is_correction,
    correctionReason: raw.correction_reason,
    photoPath: raw.photo_path,
  };
}

/**
 * Everything the pointing screen needs, in one round trip.
 *
 * The open day is read from the rows themselves rather than assumed to be today:
 * a collaboratrice who closes the shop at half past midnight is still finishing
 * yesterday, and `clock_event` will attach her departure to that day.
 */
export async function getClockState(): Promise<ClockState> {
  const { employeeId } = await requireEmployee();
  const supabase = await createServerSupabaseClient();
  const settings = await getSettings();

  const today = todayInReunion();
  const yesterday = addDays(today, -1);

  const [{ data: rawClocks }, { data: planning }] = await Promise.all([
    supabase
      .from("time_clocks")
      .select(CLOCK_COLUMNS)
      .gte("local_date", yesterday)
      .order("occurred_at", { ascending: true }),
    supabase
      .from("planning_entries")
      .select("date, status, start_time, end_time")
      .eq("date", today)
      .maybeSingle(),
  ]);

  const records = ((rawClocks ?? []) as RawClock[])
    .map(toRecord)
    .filter((record): record is ClockRecord => record !== null);

  const yesterdayEvents = records.filter((record) => record.localDate === yesterday);
  const lastYesterday = yesterdayEvents[yesterdayEvents.length - 1] ?? null;
  const openYesterday = lastYesterday !== null && lastYesterday.eventType !== "clock_out";

  const localDate = openYesterday ? yesterday : today;
  const events = records.filter((record) => record.localDate === localDate);
  const last = events[events.length - 1]?.eventType ?? null;

  return {
    employeeId,
    localDate,
    events,
    last,
    plannedStatus: planning?.status ?? null,
    plannedStart: planning?.start_time ?? null,
    plannedEnd: planning?.end_time ?? null,
    selfieRequired: settings.selfie_required,
    toleranceMinutes: settings.late_tolerance_minutes,
  };
}

/**
 * The direction's live board for one day.
 *
 * Everyone who was planned to work appears, pointed or not: a missing row is the
 * information, and an inner join on `time_clocks` would hide exactly the person
 * worth looking at.
 */
export async function getPresenceBoard(date?: DateString): Promise<PresenceRow[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const day = date ?? todayInReunion();

  const [
    { data: employees },
    { data: boutiques },
    { data: planning },
    { data: clocks },
    { data: daily },
  ] = await Promise.all([
    supabase
      .from("employees")
      .select("id, display_name, boutique_id")
      .eq("is_active", true)
      .order("display_name"),
    supabase.from("boutiques").select("id, name"),
    supabase
      .from("planning_entries")
      .select("employee_id, status, start_time, end_time")
      .eq("date", day),
    supabase
      .from("effective_time_clocks")
      .select("employee_id, event_type, occurred_at")
      .eq("local_date", day)
      .order("occurred_at", { ascending: true }),
    supabase
      .from("daily_worked_time")
      .select("employee_id, clock_in_at, clock_out_at, worked_minutes, arrival_delta_minutes")
      .eq("local_date", day),
  ]);

  const boutiqueNames = new Map((boutiques ?? []).map((boutique) => [boutique.id, boutique.name]));
  const plannedBy = new Map((planning ?? []).map((row) => [row.employee_id, row]));
  const dailyBy = new Map((daily ?? []).map((row) => [row.employee_id, row]));

  const lastBy = new Map<string, ClockEventType>();
  for (const row of clocks ?? []) {
    if (row.employee_id && isClockEventType(row.event_type ?? "")) {
      lastBy.set(row.employee_id, row.event_type as ClockEventType);
    }
  }

  return (employees ?? []).map((employee) => {
    const planned = plannedBy.get(employee.id);
    const worked = dailyBy.get(employee.id);

    return {
      employeeId: employee.id,
      displayName: employee.display_name,
      boutiqueName: boutiqueNames.get(employee.boutique_id) ?? "",
      plannedStatus: planned?.status ?? null,
      plannedStart: planned?.start_time ?? null,
      plannedEnd: planned?.end_time ?? null,
      last: lastBy.get(employee.id) ?? null,
      clockInAt: worked?.clock_in_at ?? null,
      clockOutAt: worked?.clock_out_at ?? null,
      arrivalDeltaMinutes: worked?.arrival_delta_minutes ?? null,
      workedMinutes: worked?.worked_minutes ?? null,
    };
  });
}

/** The filterable history. Defaults to the last thirty days. */
export async function getClockHistory(filters: HistoryFilters = {}): Promise<HistoryRow[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const to = filters.to ?? todayInReunion();
  const from = filters.from ?? addDays(to, -30);

  let query = supabase
    .from("daily_worked_time")
    .select(
      "employee_id, local_date, clock_in_at, clock_out_at, break_start_at, break_end_at, worked_minutes, arrival_delta_minutes",
    )
    .gte("local_date", from)
    .lte("local_date", to)
    .order("local_date", { ascending: false });

  if (filters.employeeId) query = query.eq("employee_id", filters.employeeId);

  const [{ data: rows }, { data: employees }, { data: corrections }] = await Promise.all([
    query,
    supabase.from("employees").select("id, display_name, boutique_id").eq("is_active", true),
    supabase
      .from("time_clocks")
      .select("employee_id, local_date")
      .eq("is_correction", true)
      .gte("local_date", from)
      .lte("local_date", to),
  ]);

  const names = new Map((employees ?? []).map((employee) => [employee.id, employee.display_name]));
  const boutiqueOf = new Map(
    (employees ?? []).map((employee) => [employee.id, employee.boutique_id]),
  );
  const corrected = new Set(
    (corrections ?? []).map((row) => `${row.employee_id}:${row.local_date}`),
  );

  return (rows ?? [])
    .filter((row) => row.employee_id !== null && row.local_date !== null)
    .filter(
      (row) => !filters.boutiqueId || boutiqueOf.get(row.employee_id ?? "") === filters.boutiqueId,
    )
    .map((row) => ({
      employeeId: row.employee_id ?? "",
      displayName: names.get(row.employee_id ?? "") ?? "Collaboratrice archivée",
      localDate: row.local_date ?? "",
      clockInAt: row.clock_in_at,
      clockOutAt: row.clock_out_at,
      breakStartAt: row.break_start_at,
      breakEndAt: row.break_end_at,
      arrivalDeltaMinutes: row.arrival_delta_minutes,
      workedMinutes: row.worked_minutes,
      hasCorrection: corrected.has(`${row.employee_id}:${row.local_date}`),
    }));
}

/** Short-lived signed URL for one selfie. Sixty seconds, admin only. */
export async function getSelfieUrl(photoPath: string): Promise<string | null> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.storage.from("selfies").createSignedUrl(photoPath, 60);
  if (error) {
    console.error("[pointage] URL signée impossible", error.message);
    return null;
  }

  return data.signedUrl;
}
