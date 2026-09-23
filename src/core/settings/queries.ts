import "server-only";

import { requireAdmin } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";
import { todayInReunion, type DateString } from "@/core/time";

export interface BoutiqueRow {
  id: string;
  code: string;
  name: string;
  kind: string;
  address: string | null;
  isActive: boolean;
  /** Combien de collaboratrices actives y sont rattachées, pour prévenir avant de fermer. */
  activeStaff: number;
}

export interface ContractTypeRow {
  id: string;
  code: string;
  label: string;
  isApprenticeship: boolean;
}

export interface HolidayRow {
  date: DateString;
  label: string;
}

/** Les points de vente, avec ce qu'il faut savoir avant d'en fermer un. */
export async function listBoutiques(): Promise<BoutiqueRow[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const [{ data: boutiques }, { data: employees }] = await Promise.all([
    supabase
      .from("boutiques")
      .select("id, code, name, kind, address, is_active")
      .order("sort_order"),
    supabase.from("employees").select("boutique_id").eq("is_active", true),
  ]);

  const staff = new Map<string, number>();
  for (const employee of employees ?? []) {
    staff.set(employee.boutique_id, (staff.get(employee.boutique_id) ?? 0) + 1);
  }

  return (boutiques ?? []).map((boutique) => ({
    id: boutique.id,
    code: boutique.code,
    name: boutique.name,
    kind: boutique.kind,
    address: boutique.address,
    isActive: boutique.is_active,
    activeStaff: staff.get(boutique.id) ?? 0,
  }));
}

export async function listContractTypes(): Promise<ContractTypeRow[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("contract_types")
    .select("id, code, label, is_apprenticeship")
    .order("sort_order");

  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    isApprenticeship: row.is_apprenticeship,
  }));
}

/**
 * Les jours fériés à venir.
 *
 * Ceux du passé ne servent plus à rien : un décompte déjà arrêté ne se recalcule
 * pas, et une liste de trois ans en arrière ne ferait que cacher celle qu'il
 * faut tenir à jour.
 */
export async function listUpcomingHolidays(): Promise<HolidayRow[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("public_holidays")
    .select("date, label")
    .gte("date", todayInReunion())
    .order("date");

  return (data ?? []).map((row) => ({ date: row.date, label: row.label }));
}
