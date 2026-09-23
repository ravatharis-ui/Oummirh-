import "server-only";

import { requireAdmin, requireEmployee } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";
import { addDays, todayInReunion, type DateString } from "@/core/time";

import { availabilityRank, isAvailability, isReplacementStatus } from "../domain/availability";
import type { Candidate, ReplacementRow } from "../types";

const COLUMNS =
  "id, employee_id, boutique_id, date, start_time, end_time, break_start, break_end, note, status, created_at";

interface RawReplacement {
  id: string;
  employee_id: string;
  boutique_id: string;
  date: string;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  note: string | null;
  status: string;
  created_at: string;
}

function toRow(raw: RawReplacement, displayName: string, boutiqueName: string): ReplacementRow {
  return {
    id: raw.id,
    employeeId: raw.employee_id,
    displayName,
    boutiqueId: raw.boutique_id,
    boutiqueName,
    date: raw.date,
    startTime: raw.start_time,
    endTime: raw.end_time,
    breakStart: raw.break_start,
    breakEnd: raw.break_end,
    note: raw.note,
    status: isReplacementStatus(raw.status) ? raw.status : "cancelled",
    createdAt: raw.created_at,
  };
}

/**
 * Qui peut venir, et à quel prix.
 *
 * Le tri met les plus faciles à solliciter en tête : quelqu'un qui cherche un
 * renfort dans l'urgence ne doit pas lire toute la liste pour trouver qui est
 * libre.
 */
export async function getCandidates(date: DateString, boutiqueId?: string): Promise<Candidate[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("admin_replacement_candidates", {
    p_date: date,
    ...(boutiqueId ? { p_boutique_id: boutiqueId } : {}),
  });

  if (error) {
    console.error("[remplacements] Disponibilités indisponibles", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => ({
      employeeId: row.employee_id,
      displayName: row.display_name,
      homeBoutique: row.home_boutique,
      availability: isAvailability(row.availability) ? row.availability : "unavailable",
      plannedStatus: row.planned_status,
      plannedStart: row.planned_start,
      plannedEnd: row.planned_end,
      plannedShop: row.planned_shop,
    }))
    .sort(
      (a, b) =>
        availabilityRank(a.availability) - availabilityRank(b.availability) ||
        a.displayName.localeCompare(b.displayName, "fr"),
    );
}

/** L'historique, côté direction. Les remplacements à venir d'abord. */
export async function listReplacements(): Promise<ReplacementRow[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const from = addDays(todayInReunion(), -60);

  const [{ data }, { data: employees }, { data: boutiques }] = await Promise.all([
    supabase
      .from("direct_replacements")
      .select(COLUMNS)
      .gte("date", from)
      .order("date", { ascending: false })
      .limit(200),
    supabase.from("employees").select("id, display_name"),
    supabase.from("boutiques").select("id, name"),
  ]);

  const names = new Map((employees ?? []).map((employee) => [employee.id, employee.display_name]));
  const shops = new Map((boutiques ?? []).map((boutique) => [boutique.id, boutique.name]));

  return ((data ?? []) as RawReplacement[]).map((raw) =>
    toRow(raw, names.get(raw.employee_id) ?? "—", shops.get(raw.boutique_id) ?? "—"),
  );
}

/** Ses propres remplacements à venir. La RLS fait le cloisonnement. */
export async function getMyReplacements(): Promise<ReplacementRow[]> {
  await requireEmployee();
  const supabase = await createServerSupabaseClient();

  const [{ data }, { data: boutiques }] = await Promise.all([
    supabase
      .from("direct_replacements")
      .select(COLUMNS)
      .eq("status", "active")
      .gte("date", todayInReunion())
      .order("date"),
    supabase.from("boutiques").select("id, name"),
  ]);

  const shops = new Map((boutiques ?? []).map((boutique) => [boutique.id, boutique.name]));

  return ((data ?? []) as RawReplacement[]).map((raw) =>
    toRow(raw, "", shops.get(raw.boutique_id) ?? "—"),
  );
}
