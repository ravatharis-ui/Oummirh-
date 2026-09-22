import "server-only";

import { requireAdmin } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";

import type { EmployeeFilters } from "../schemas";
import type { EmployeeSummary } from "../types";

/**
 * Columns are always listed explicitly.
 *
 * `select *` fails on this table: `pin_hash` is granted to no role, so expanding
 * the star asks for a column nobody may read. That is deliberate — the hash must
 * never be reachable through a query, however the caller is authenticated.
 */
const COLUMNS = [
  "id",
  "auth_user_id",
  "last_name",
  "first_name",
  "display_name",
  "boutique_id",
  "contract_type_id",
  "email",
  "phone",
  "weekly_contract_hours",
  "default_start",
  "default_end",
  "default_break_start",
  "default_break_end",
  "work_days",
  "hire_date",
  "end_date",
  "is_active",
  "boutiques(name)",
  "contract_types(label)",
].join(", ");

interface RawEmployee {
  id: string;
  auth_user_id: string | null;
  last_name: string;
  first_name: string;
  display_name: string;
  boutique_id: string;
  contract_type_id: string;
  email: string | null;
  phone: string | null;
  weekly_contract_hours: number | null;
  default_start: string;
  default_end: string;
  default_break_start: string | null;
  default_break_end: string | null;
  work_days: number[];
  hire_date: string | null;
  end_date: string | null;
  is_active: boolean;
  boutiques: { name: string } | null;
  contract_types: { label: string } | null;
}

function toSummary(row: RawEmployee): EmployeeSummary {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    lastName: row.last_name,
    firstName: row.first_name,
    displayName: row.display_name,
    boutiqueId: row.boutique_id,
    boutiqueName: row.boutiques?.name ?? "—",
    contractTypeId: row.contract_type_id,
    contractLabel: row.contract_types?.label ?? "—",
    email: row.email,
    phone: row.phone,
    weeklyContractHours: row.weekly_contract_hours,
    defaultStart: row.default_start,
    defaultEnd: row.default_end,
    defaultBreakStart: row.default_break_start,
    defaultBreakEnd: row.default_break_end,
    workDays: row.work_days,
    hireDate: row.hire_date,
    endDate: row.end_date,
    isActive: row.is_active,
  };
}

export async function listEmployees(filters: EmployeeFilters): Promise<EmployeeSummary[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  let query = supabase.from("employees").select(COLUMNS);
  if (filters.boutiqueId) query = query.eq("boutique_id", filters.boutiqueId);
  if (filters.contractTypeId) query = query.eq("contract_type_id", filters.contractTypeId);
  if (filters.status !== "all") query = query.eq("is_active", filters.status === "active");

  const { data, error } = await query.order("last_name").order("first_name");
  if (error) {
    console.error("[employees] Liste impossible", error.message);
    return [];
  }
  return (data as unknown as RawEmployee[]).map(toSummary);
}

export async function getEmployee(id: string): Promise<EmployeeSummary | null> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("employees")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toSummary(data as unknown as RawEmployee);
}

export interface ReferenceData {
  boutiques: { id: string; name: string }[];
  contractTypes: { id: string; label: string }[];
}

/** Options for the dropdowns on the collaboratrice form. */
export async function getReferenceData(): Promise<ReferenceData> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const [boutiques, contractTypes] = await Promise.all([
    supabase.from("boutiques").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("contract_types").select("id, label").order("sort_order"),
  ]);

  return {
    boutiques: boutiques.data ?? [],
    contractTypes: contractTypes.data ?? [],
  };
}
