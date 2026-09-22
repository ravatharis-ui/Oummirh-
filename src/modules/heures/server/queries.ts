import "server-only";

import { requireAdmin, requireEmployee } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";
import { addDays, todayInReunion, workedMinutes, type DateString } from "@/core/time";

import { cumulativeMinutes, monthlyTotals, type HoursMovement } from "../domain/monthly";
import {
  availableMinutes,
  isRecoveryMode,
  isRecoveryStatus,
  type RecoveryMode,
  type RecoveryStatus,
} from "../domain/recovery";
import type { HoursMonthRow, HoursMovementRow, MyHoursState, RecoveryRequestRow } from "../types";

const RECOVERY_COLUMNS =
  "id, employee_id, date, mode, minutes, status, admin_comment, decided_at, created_at";

interface RawRecovery {
  id: string;
  employee_id: string;
  date: string;
  mode: string;
  minutes: number;
  status: string;
  admin_comment: string | null;
  decided_at: string | null;
  created_at: string;
}

function toRecovery(raw: RawRecovery, displayName: string): RecoveryRequestRow {
  const mode: RecoveryMode = isRecoveryMode(raw.mode) ? raw.mode : "later";
  const status: RecoveryStatus = isRecoveryStatus(raw.status) ? raw.status : "pending";

  return {
    id: raw.id,
    employeeId: raw.employee_id,
    displayName,
    date: raw.date,
    mode,
    minutes: raw.minutes,
    status,
    adminComment: raw.admin_comment,
    decidedAt: raw.decided_at,
    createdAt: raw.created_at,
  };
}

/**
 * Tout ce que la carte « Mon solde d'heures » et son bouton ont besoin de savoir.
 *
 * Les journées éligibles sont calculées ici : seules ses journées de travail à
 * venir peuvent porter une récupération, et lui proposer un jour de repos
 * reviendrait à lui faire perdre du temps pour rien.
 */
export async function getMyHoursState(): Promise<MyHoursState> {
  const { employeeId } = await requireEmployee();
  const supabase = await createServerSupabaseClient();

  const today = todayInReunion();
  const horizon = addDays(today, 60);

  const [balanceResult, movementsResult, requestsResult, planningResult] = await Promise.all([
    supabase.rpc("hours_balance", {}),
    supabase
      .from("hours_ledger")
      .select("id, kind, minutes, local_date, note")
      .order("local_date", { ascending: false })
      .limit(90),
    supabase
      .from("recovery_requests")
      .select(RECOVERY_COLUMNS)
      .order("date", { ascending: false })
      .limit(50),
    supabase
      .from("planning_entries")
      .select("date, status, start_time, end_time")
      .gt("date", today)
      .lte("date", horizon)
      .in("status", ["work", "replacement"])
      .order("date"),
  ]);

  const requests = ((requestsResult.data ?? []) as RawRecovery[]).map((raw) => toRecovery(raw, ""));

  const pendingMinutes = requests
    .filter((request) => request.status === "pending")
    .reduce((total, request) => total + request.minutes, 0);

  const takenDates = new Set(
    requests
      .filter((request) => request.status === "pending" || request.status === "approved")
      .map((request) => request.date),
  );

  const movements: HoursMovementRow[] = (movementsResult.data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    minutes: row.minutes,
    localDate: row.local_date,
    note: row.note,
  }));

  const balanceMinutes = Number(balanceResult.data ?? 0);

  return {
    employeeId,
    balanceMinutes,
    pendingMinutes,
    availableMinutes: availableMinutes(balanceMinutes, pendingMinutes),
    movements,
    requests,
    eligibleDays: (planningResult.data ?? [])
      .filter((row) => row.start_time && row.end_time && !takenDates.has(row.date))
      .map((row) => ({
        date: row.date,
        startTime: (row.start_time ?? "").slice(0, 5),
        endTime: (row.end_time ?? "").slice(0, 5),
      })),
  };
}

/** Les demandes de récupération, côté direction. */
export async function getRecoveryRequests(status?: RecoveryStatus): Promise<RecoveryRequestRow[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("recovery_requests")
    .select(RECOVERY_COLUMNS)
    .order("date", { ascending: true })
    .limit(200);

  if (status) query = query.eq("status", status);

  const [{ data }, { data: employees }] = await Promise.all([
    query,
    supabase.from("employees").select("id, display_name"),
  ]);

  const names = new Map((employees ?? []).map((employee) => [employee.id, employee.display_name]));

  return ((data ?? []) as RawRecovery[]).map((raw) =>
    toRecovery(raw, names.get(raw.employee_id) ?? "Collaboratrice archivée"),
  );
}

/**
 * Le tableau du mois.
 *
 * Contractuel, planifié, réel, écart du mois, solde cumulé. Les quatre premiers
 * décrivent le mois ; le dernier est ce qui compte vraiment, parce que c'est lui
 * qui se récupère.
 */
export async function getHoursMonth(
  month?: string,
  boutiqueId?: string,
): Promise<{ month: string; rows: HoursMonthRow[] }> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const reference = month ?? todayInReunion().slice(0, 7);
  const monthStart: DateString = `${reference}-01`;
  const monthEnd: DateString = addDays(monthStart, 40).slice(0, 7) + "-01";

  const [
    { data: employees },
    { data: boutiques },
    { data: ledger },
    { data: planning },
    { data: daily },
  ] = await Promise.all([
    supabase
      .from("employees")
      .select("id, display_name, boutique_id, weekly_contract_hours")
      .eq("is_active", true)
      .order("display_name"),
    supabase.from("boutiques").select("id, name"),
    supabase.from("hours_ledger").select("employee_id, kind, minutes, local_date"),
    supabase
      .from("planning_entries")
      .select("employee_id, status, start_time, end_time, break_start, break_end, date")
      .gte("date", monthStart)
      .lt("date", monthEnd),
    supabase
      .from("daily_worked_time")
      .select("employee_id, worked_minutes")
      .gte("local_date", monthStart)
      .lt("local_date", monthEnd),
  ]);

  const boutiqueNames = new Map((boutiques ?? []).map((boutique) => [boutique.id, boutique.name]));

  const byEmployee = new Map<string, HoursMovement[]>();
  for (const row of ledger ?? []) {
    const bucket = byEmployee.get(row.employee_id) ?? [];
    bucket.push({ kind: row.kind, minutes: row.minutes, localDate: row.local_date });
    byEmployee.set(row.employee_id, bucket);
  }

  const plannedBy = new Map<string, number>();
  for (const row of planning ?? []) {
    if (row.status !== "work" && row.status !== "replacement") continue;
    if (!row.start_time || !row.end_time) continue;

    try {
      const minutes = workedMinutes({
        start: row.start_time,
        end: row.end_time,
        breakStart: row.break_start,
        breakEnd: row.break_end,
      });
      plannedBy.set(row.employee_id, (plannedBy.get(row.employee_id) ?? 0) + minutes);
    } catch {
      // Une ligne de planning incohérente ne doit pas vider tout le tableau.
    }
  }

  const workedBy = new Map<string, number>();
  for (const row of daily ?? []) {
    if (!row.employee_id || row.worked_minutes === null) continue;
    workedBy.set(row.employee_id, (workedBy.get(row.employee_id) ?? 0) + row.worked_minutes);
  }

  const rows = (employees ?? [])
    .filter((employee) => !boutiqueId || employee.boutique_id === boutiqueId)
    .map((employee) => {
      const movements = byEmployee.get(employee.id) ?? [];

      return {
        employeeId: employee.id,
        displayName: employee.display_name,
        boutiqueName: boutiqueNames.get(employee.boutique_id) ?? "",
        contractMinutes:
          employee.weekly_contract_hours === null
            ? null
            : Math.round(employee.weekly_contract_hours * 60),
        plannedMinutes: plannedBy.get(employee.id) ?? 0,
        workedMinutes: workedBy.get(employee.id) ?? 0,
        monthMinutes: monthlyTotals(movements, monthStart).monthMinutes,
        balanceMinutes: cumulativeMinutes(movements),
      };
    });

  return { month: reference, rows };
}
