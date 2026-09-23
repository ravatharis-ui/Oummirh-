import "server-only";

import { requireAdmin, requireEmployee } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";
import { addDays, todayInReunion } from "@/core/time";

import { isSwapStatus, type SwapStatus } from "../domain/status";
import type { Colleague, MySwapsState, SwapRow, SwappableDay } from "../types";

const COLUMNS =
  "id, requester_id, requester_date, partner_id, partner_date, message, status, admin_comment, created_at";

interface RawSwap {
  id: string;
  requester_id: string;
  requester_date: string;
  partner_id: string;
  partner_date: string;
  message: string | null;
  status: string;
  admin_comment: string | null;
  created_at: string;
}

function toRow(raw: RawSwap, names: Map<string, string>): SwapRow {
  const status: SwapStatus = isSwapStatus(raw.status) ? raw.status : "cancelled";

  return {
    id: raw.id,
    requesterId: raw.requester_id,
    requesterName: names.get(raw.requester_id) ?? "Une collègue",
    requesterDate: raw.requester_date,
    partnerId: raw.partner_id,
    partnerName: names.get(raw.partner_id) ?? "Une collègue",
    partnerDate: raw.partner_date,
    message: raw.message,
    status,
    adminComment: raw.admin_comment,
    createdAt: raw.created_at,
  };
}

/**
 * Tout ce que l'écran d'échange a besoin de savoir.
 *
 * Les journées des collègues arrivent par `swappable_days`, qui ne renvoie que
 * ce qui est échangeable : un congé ou un arrêt maladie n'y figure pas, et reste
 * donc invisible. C'est la même règle que la présence du jour.
 */
export async function getMySwapsState(): Promise<MySwapsState> {
  const { employeeId } = await requireEmployee();
  const supabase = await createServerSupabaseClient();

  const from = addDays(todayInReunion(), 1);
  const to = addDays(todayInReunion(), 60);

  const [mineResult, colleaguesResult, swapsResult] = await Promise.all([
    supabase.rpc("swappable_days", { p_employee_id: employeeId, p_from: from, p_to: to }),
    supabase.rpc("swap_colleagues"),
    supabase
      .from("shift_swaps")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const colleagueRows = colleaguesResult.data ?? [];

  // Une requête par collègue : la liste fait cinq à quinze personnes, et le
  // gain d'une requête unique ne vaudrait pas une fonction SQL de plus.
  const colleagues: Colleague[] = await Promise.all(
    colleagueRows.map(async (row) => {
      const { data } = await supabase.rpc("swappable_days", {
        p_employee_id: row.employee_id,
        p_from: from,
        p_to: to,
      });

      return {
        employeeId: row.employee_id,
        displayName: row.display_name,
        boutiqueName: row.boutique_name,
        sameBoutique: row.same_boutique,
        days: (data ?? []).map((day): SwappableDay => ({
          date: day.date,
          status: day.status,
          startTime: day.start_time,
          endTime: day.end_time,
        })),
      };
    }),
  );

  const names = new Map<string, string>([
    ...colleagueRows.map((row): [string, string] => [row.employee_id, row.display_name]),
    [employeeId, "toi"],
  ]);

  const swaps = ((swapsResult.data ?? []) as RawSwap[]).map((raw) => toRow(raw, names));

  return {
    employeeId,
    myDays: (mineResult.data ?? []).map((day): SwappableDay => ({
      date: day.date,
      status: day.status,
      startTime: day.start_time,
      endTime: day.end_time,
    })),
    colleagues,
    sent: swaps.filter((swap) => swap.requesterId === employeeId),
    received: swaps.filter((swap) => swap.partnerId === employeeId),
  };
}

/** Les échanges qui attendent la direction. */
export async function getSwapsForAdmin(status?: SwapStatus): Promise<SwapRow[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("shift_swaps")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status", status);

  const [{ data }, { data: employees }] = await Promise.all([
    query,
    supabase.from("employees").select("id, display_name"),
  ]);

  const names = new Map((employees ?? []).map((employee) => [employee.id, employee.display_name]));

  return ((data ?? []) as RawSwap[]).map((raw) => toRow(raw, names));
}
