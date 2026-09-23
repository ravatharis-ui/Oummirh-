import "server-only";

import { requireAdmin, requireEmployee } from "@/core/auth";
import { createServerSupabaseClient } from "@/core/db/server";

import { isDocumentCategory, type DocumentCategory } from "../domain/categories";
import type { MatchableEmployee } from "../domain/matching";
import type { DocumentRow, EmployeeDocuments } from "../types";

const COLUMNS =
  "id, employee_id, category, title, period_month, size_bytes, first_viewed_at, created_at";

interface RawDocument {
  id: string;
  employee_id: string;
  category: string;
  title: string;
  period_month: string | null;
  size_bytes: number;
  first_viewed_at: string | null;
  created_at: string;
}

function toRow(raw: RawDocument, displayName: string): DocumentRow {
  const category: DocumentCategory = isDocumentCategory(raw.category) ? raw.category : "other";

  return {
    id: raw.id,
    employeeId: raw.employee_id,
    displayName,
    category,
    title: raw.title,
    periodMonth: raw.period_month,
    sizeBytes: raw.size_bytes,
    firstViewedAt: raw.first_viewed_at,
    createdAt: raw.created_at,
  };
}

/**
 * Ses documents à elle.
 *
 * Aucun filtre sur l'identifiant : la RLS s'en charge, et c'est elle qui fait
 * foi. Filtrer ici en plus donnerait l'illusion que la sécurité tient au code
 * de cette fonction.
 */
export async function getMyDocuments(): Promise<DocumentRow[]> {
  await requireEmployee();
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("documents")
    .select(COLUMNS)
    .order("period_month", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return ((data ?? []) as RawDocument[]).map((raw) => toRow(raw, ""));
}

/** Les coffres de toute l'équipe, côté direction. */
export async function listEmployeeDocuments(): Promise<EmployeeDocuments[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const [{ data: employees }, { data: documents }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, display_name, last_name, first_name")
      .eq("is_active", true)
      .order("display_name"),
    supabase.from("documents").select(COLUMNS).order("created_at", { ascending: false }),
  ]);

  const byEmployee = new Map<string, RawDocument[]>();
  for (const raw of (documents ?? []) as RawDocument[]) {
    const bucket = byEmployee.get(raw.employee_id) ?? [];
    bucket.push(raw);
    byEmployee.set(raw.employee_id, bucket);
  }

  return (employees ?? []).map((employee) => {
    const rows = (byEmployee.get(employee.id) ?? []).map((raw) =>
      toRow(raw, employee.display_name),
    );

    return {
      employeeId: employee.id,
      displayName: employee.display_name,
      lastName: employee.last_name,
      firstName: employee.first_name,
      documents: rows,
      neverOpened: rows.filter((row) => row.firstViewedAt === null).length,
    };
  });
}

/** De quoi reconnaître une collaboratrice dans un nom de fichier. */
export async function getMatchableEmployees(): Promise<MatchableEmployee[]> {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("employees")
    .select("id, display_name, last_name, first_name")
    .eq("is_active", true)
    .order("display_name");

  return (data ?? []).map((employee) => ({
    employeeId: employee.id,
    displayName: employee.display_name,
    lastName: employee.last_name,
    firstName: employee.first_name,
  }));
}
