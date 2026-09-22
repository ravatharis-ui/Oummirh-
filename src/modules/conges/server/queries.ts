import "server-only";

import { requireAdmin, requireEmployee } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";
import { addDays, todayInReunion, type DateString } from "@/core/time";

import { isLeaveStatus, type HalfDay, type LeaveStatus } from "../domain/count";
import type {
  LeaveBalanceRow,
  LeaveMovement,
  LeaveOverlap,
  LeaveRequestRow,
  MyLeaveState,
} from "../types";

const REQUEST_COLUMNS =
  "id, employee_id, start_date, end_date, start_half, end_half, days, status, reason, admin_comment, decided_at, created_at";

interface RawRequest {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  start_half: string | null;
  end_half: string | null;
  days: number;
  status: string;
  reason: string | null;
  admin_comment: string | null;
  decided_at: string | null;
  created_at: string;
}

function toRequest(raw: RawRequest, displayName: string): LeaveRequestRow {
  const status: LeaveStatus = isLeaveStatus(raw.status) ? raw.status : "pending";

  return {
    id: raw.id,
    employeeId: raw.employee_id,
    displayName,
    startDate: raw.start_date,
    endDate: raw.end_date,
    startHalf: (raw.start_half as HalfDay | null) ?? null,
    endHalf: (raw.end_half as HalfDay | null) ?? null,
    days: Number(raw.days),
    status,
    reason: raw.reason,
    adminComment: raw.admin_comment,
    decidedAt: raw.decided_at,
    createdAt: raw.created_at,
  };
}

/**
 * Tout ce que l'écran de la collaboratrice montre.
 *
 * Les jours fériés et ses jours de repos partent avec : le calendrier de
 * sélection doit pouvoir dire « ces trois jours ne te coûteront rien » avant
 * qu'elle valide, pas après.
 */
export async function getMyLeaveState(): Promise<MyLeaveState> {
  const { employeeId } = await requireEmployee();
  const supabase = await createServerSupabaseClient();

  const today = todayInReunion();
  const horizon = addDays(today, 400);

  const [
    periodResult,
    balanceResult,
    requestsResult,
    movementsResult,
    holidaysResult,
    planningResult,
  ] = await Promise.all([
    supabase.rpc("leave_period_start", { p_date: today }),
    supabase.rpc("leave_balance", {}),
    supabase
      .from("leave_requests")
      .select(REQUEST_COLUMNS)
      .order("start_date", { ascending: false })
      .limit(50),
    supabase
      .from("leave_ledger")
      .select("id, kind, days, occurred_on, note")
      .order("occurred_on", { ascending: false })
      .limit(50),
    supabase.from("public_holidays").select("date").gte("date", today).lte("date", horizon),
    supabase
      .from("planning_entries")
      .select("date, status")
      .gte("date", today)
      .lte("date", horizon)
      .in("status", ["rest", "school"]),
  ]);

  const periodStart: DateString = periodResult.data ?? today;

  const movements: LeaveMovement[] = (movementsResult.data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    days: Number(row.days),
    occurredOn: row.occurred_on,
    note: row.note,
  }));

  return {
    employeeId,
    periodStart,
    balance: Number(balanceResult.data ?? 0),
    requests: ((requestsResult.data ?? []) as RawRequest[]).map((raw) => toRequest(raw, "")),
    movements,
    holidays: (holidaysResult.data ?? []).map((row) => row.date),
    nonWorkingDays: (planningResult.data ?? []).map((row) => row.date),
  };
}

/** Les demandes, côté direction. En attente d'abord : ce sont elles qui attendent. */
export async function getLeaveRequests(status?: LeaveStatus): Promise<LeaveRequestRow[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("leave_requests")
    .select(REQUEST_COLUMNS)
    .order("start_date", { ascending: true })
    .limit(200);

  if (status) query = query.eq("status", status);

  const [{ data }, { data: employees }] = await Promise.all([
    query,
    supabase.from("employees").select("id, display_name"),
  ]);

  const names = new Map((employees ?? []).map((employee) => [employee.id, employee.display_name]));

  return ((data ?? []) as RawRequest[]).map((raw) =>
    toRequest(raw, names.get(raw.employee_id) ?? "Collaboratrice archivée"),
  );
}

/** Les soldes de toute l'équipe, pour la période en cours. */
export async function getLeaveBalances(): Promise<LeaveBalanceRow[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const { data: periodStart } = await supabase.rpc("leave_period_start", {
    p_date: todayInReunion(),
  });

  const [{ data: employees }, { data: boutiques }, { data: ledger }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, display_name, boutique_id")
      .eq("is_active", true)
      .order("display_name"),
    supabase.from("boutiques").select("id, name"),
    supabase
      .from("leave_ledger")
      .select("employee_id, days")
      .eq("period_start", periodStart ?? todayInReunion()),
  ]);

  const boutiqueNames = new Map((boutiques ?? []).map((boutique) => [boutique.id, boutique.name]));

  const balances = new Map<string, number>();
  for (const row of ledger ?? []) {
    balances.set(row.employee_id, (balances.get(row.employee_id) ?? 0) + Number(row.days));
  }

  return (employees ?? []).map((employee) => ({
    employeeId: employee.id,
    displayName: employee.display_name,
    boutiqueName: boutiqueNames.get(employee.boutique_id) ?? "",
    balance: Math.round((balances.get(employee.id) ?? 0) * 100) / 100,
  }));
}

/**
 * Qui d'autre est absent aux mêmes dates.
 *
 * Réservé à la direction, qui en a besoin pour décider. Une collaboratrice n'a
 * pas à savoir qui a posé quoi.
 */
export async function getLeaveOverlaps(
  employeeId: string,
  from: DateString,
  to: DateString,
): Promise<LeaveOverlap[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("admin_leave_overlaps", {
    p_employee_id: employeeId,
    p_from: from,
    p_to: to,
  });

  if (error) {
    console.error("[conges] Chevauchements indisponibles", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    employeeId: row.employee_id,
    displayName: row.display_name,
    startDate: row.start_date,
    endDate: row.end_date,
  }));
}

/** Le calendrier des absences d'un mois, par boutique. */
export async function getAbsenceCalendar(
  month: DateString,
  boutiqueId?: string,
): Promise<LeaveRequestRow[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const monthStart = `${month.slice(0, 7)}-01`;
  const monthEnd = addDays(`${month.slice(0, 7)}-01`, 40);

  const [{ data }, { data: employees }] = await Promise.all([
    supabase
      .from("leave_requests")
      .select(REQUEST_COLUMNS)
      .eq("status", "approved")
      .lte("start_date", monthEnd)
      .gte("end_date", monthStart)
      .order("start_date"),
    supabase.from("employees").select("id, display_name, boutique_id"),
  ]);

  const byId = new Map((employees ?? []).map((employee) => [employee.id, employee]));

  return ((data ?? []) as RawRequest[])
    .filter((raw) => !boutiqueId || byId.get(raw.employee_id)?.boutique_id === boutiqueId)
    .map((raw) => toRequest(raw, byId.get(raw.employee_id)?.display_name ?? "—"));
}
