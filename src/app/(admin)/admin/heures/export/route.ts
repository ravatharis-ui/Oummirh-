import { requireAdmin } from "@/core/auth";
import { formatDuration } from "@/core/time";
import { getHoursMonth, toCsv } from "@/modules/heures";

export const dynamic = "force-dynamic";

/**
 * L'export du mois.
 *
 * Point-virgule et décimales à la virgule : c'est ce qu'Excel en français
 * attend, et un fichier qui s'ouvre en une seule colonne n'est pas un export.
 * Le BOM en tête est ce qui fait qu'« Aurélie » ne devient pas « AurÃ©lie ».
 */
export async function GET(request: Request): Promise<Response> {
  await requireAdmin();

  const month = new URL(request.url).searchParams.get("month") ?? undefined;
  const { month: resolved, rows } = await getHoursMonth(month ?? undefined);

  const csv = toCsv([
    ["Collaboratrice", "Point de vente", "Planifié", "Réel", "Écart du mois", "Solde cumulé"],
    ...rows.map((row) => [
      row.displayName,
      row.boutiqueName,
      formatDuration(row.plannedMinutes),
      formatDuration(row.workedMinutes),
      formatDuration(row.monthMinutes),
      formatDuration(row.balanceMinutes),
    ]),
  ]);

  return new Response(`﻿${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="heures-${resolved}.csv"`,
    },
  });
}
