import "server-only";

import { requireAdmin, requireEmployee } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";
import {
  isoWeekDates,
  startOfIsoWeek,
  todayInReunion,
  type DateString,
  type TimeString,
} from "@/core/time";

import { weekBalanceMinutes, weekMinutes, type PlannedDay } from "../domain/week";
import type { PlanningEntry, PlanningRow, PlanningWeek, PresentColleague } from "../types";

const ENTRY_COLUMNS =
  "id, employee_id, boutique_id, date, status, start_time, end_time, break_start, break_end, note, source";

interface RawEntry {
  id: string;
  employee_id: string;
  boutique_id: string;
  date: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  break_start: string | null;
  break_end: string | null;
  note: string | null;
  source: string;
}

function toEntry(raw: RawEntry): PlanningEntry {
  return {
    id: raw.id,
    employeeId: raw.employee_id,
    boutiqueId: raw.boutique_id,
    date: raw.date,
    status: raw.status,
    startTime: raw.start_time,
    endTime: raw.end_time,
    breakStart: raw.break_start,
    breakEnd: raw.break_end,
    note: raw.note,
    source: raw.source,
  };
}

function toPlannedDay(entry: PlanningEntry): PlannedDay {
  return {
    date: entry.date,
    status: entry.status,
    startTime: entry.startTime,
    endTime: entry.endTime,
    breakStart: entry.breakStart,
    breakEnd: entry.breakEnd,
  };
}

/**
 * The weekly matrix.
 *
 * Two queries rather than an embedded join: `employees` refuses `select *`
 * because of `pin_hash`, and a collaboratrice with no planned day at all must
 * still appear as an empty row — an inner join would hide exactly the person the
 * direction is looking for.
 */
export async function getPlanningWeek(
  week?: DateString,
  boutiqueId?: string,
): Promise<PlanningWeek> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const weekStart = startOfIsoWeek(week ?? todayInReunion());
  const dates = isoWeekDates(weekStart);
  const firstDate = dates[0] ?? weekStart;
  const lastDate = dates[dates.length - 1] ?? weekStart;

  const [{ data: boutiques }, employeesResult] = await Promise.all([
    supabase.from("boutiques").select("id, name").eq("is_active", true).order("sort_order"),
    supabase
      .from("employees")
      .select("id, display_name, boutique_id, weekly_contract_hours")
      .eq("is_active", true)
      .order("display_name"),
  ]);

  const employees = (employeesResult.data ?? []).filter(
    (employee) => !boutiqueId || employee.boutique_id === boutiqueId,
  );

  const boutiqueNames = new Map((boutiques ?? []).map((boutique) => [boutique.id, boutique.name]));

  const { data: rawEntries } = await supabase
    .from("planning_entries")
    .select(ENTRY_COLUMNS)
    .gte("date", firstDate)
    .lte("date", lastDate);

  const byEmployee = new Map<string, PlanningEntry[]>();
  for (const raw of (rawEntries ?? []) as RawEntry[]) {
    const entry = toEntry(raw);
    const bucket = byEmployee.get(entry.employeeId);
    if (bucket) bucket.push(entry);
    else byEmployee.set(entry.employeeId, [entry]);
  }

  const rows: PlanningRow[] = employees.map((employee) => {
    const entries = byEmployee.get(employee.id) ?? [];
    const days: Record<DateString, PlanningEntry> = {};
    for (const entry of entries) days[entry.date] = entry;

    const plannedDays = entries.map(toPlannedDay);

    return {
      employeeId: employee.id,
      displayName: employee.display_name,
      boutiqueId: employee.boutique_id,
      boutiqueName: boutiqueNames.get(employee.boutique_id) ?? "",
      weeklyContractHours: employee.weekly_contract_hours,
      days,
      plannedMinutes: weekMinutes(plannedDays),
      balanceMinutes: weekBalanceMinutes(plannedDays, employee.weekly_contract_hours),
    };
  });

  return {
    weekStart,
    dates,
    rows,
    boutiques: (boutiques ?? []).map((boutique) => ({ id: boutique.id, name: boutique.name })),
    boutiqueId: boutiqueId ?? null,
  };
}

/** The signed-in collaboratrice's own week. RLS is what limits it to her. */
export async function getMyWeek(week?: DateString): Promise<{
  weekStart: DateString;
  dates: DateString[];
  entries: Record<DateString, PlanningEntry>;
  plannedMinutes: number;
}> {
  await requireEmployee();
  const supabase = await createServerSupabaseClient();

  const weekStart = startOfIsoWeek(week ?? todayInReunion());
  const dates = isoWeekDates(weekStart);
  const firstDate = dates[0] ?? weekStart;
  const lastDate = dates[dates.length - 1] ?? weekStart;

  const { data } = await supabase
    .from("planning_entries")
    .select(ENTRY_COLUMNS)
    .gte("date", firstDate)
    .lte("date", lastDate)
    .order("date");

  const entries: Record<DateString, PlanningEntry> = {};
  const planned: PlannedDay[] = [];

  for (const raw of (data ?? []) as RawEntry[]) {
    const entry = toEntry(raw);
    entries[entry.date] = entry;
    planned.push(toPlannedDay(entry));
  }

  return { weekStart, dates, entries, plannedMinutes: weekMinutes(planned) };
}

/**
 * Who else is on the floor today.
 *
 * Through the dedicated function, never through the table: it returns the
 * colleagues who are *present*, and says nothing about why the others are not.
 * A collaboratrice has no business learning that a colleague is on sick leave.
 */
export async function getPresence(date?: DateString): Promise<PresentColleague[]> {
  await requireEmployee();
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("my_boutique_presence", {
    p_date: date ?? todayInReunion(),
  });

  if (error) {
    console.error("[planning] Présence du jour indisponible", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    employeeId: row.employee_id,
    displayName: row.display_name,
    startTime: row.start_time,
    endTime: row.end_time,
  }));
}

/** La semaine type d'une collaboratrice, lundi → dimanche. */
export interface TemplateDay {
  weekday: number;
  status: string;
  startTime: TimeString | null;
  endTime: TimeString | null;
  breakStart: TimeString | null;
  breakEnd: TimeString | null;
}

/**
 * Lit la semaine type.
 *
 * Elle ne change aucun planning par elle-même : elle sert à le remplir, jour
 * par jour, quand la direction le demande. D'où sa place à part — ce n'est pas
 * un planning, c'est une habitude.
 */
export async function getPlanningTemplate(employeeId: string): Promise<TemplateDay[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("planning_templates")
    .select("weekday, status, start_time, end_time, break_start, break_end")
    .eq("employee_id", employeeId)
    .order("weekday");

  return (data ?? []).map((row) => ({
    weekday: row.weekday,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time,
    breakStart: row.break_start,
    breakEnd: row.break_end,
  }));
}
