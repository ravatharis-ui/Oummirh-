import { formatFrDateShort, formatFrMonth, type DateString } from "@/core/time";

import { formatLeaveDays } from "../../domain/count";
import type { LeaveRequestRow } from "../../types";

/**
 * Le calendrier des absences.
 *
 * Une liste par collaboratrice plutôt qu'une grille de trente cases : ce que la
 * direction cherche ici, c'est « qui manque et quand », pas un dessin du mois.
 */
export function AbsenceCalendar({
  month,
  absences,
}: {
  month: DateString;
  absences: LeaveRequestRow[];
}) {
  if (absences.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center">
        Aucune absence validée en {formatFrMonth(month)}.
      </p>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-medium capitalize">{formatFrMonth(month)}</h2>
      <ul className="flex flex-col gap-2">
        {absences.map((absence) => (
          <li
            key={absence.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
          >
            <span className="font-medium">{absence.displayName}</span>
            <span className="text-muted-foreground text-sm tabular-nums">
              {formatFrDateShort(absence.startDate)} → {formatFrDateShort(absence.endDate)} ·{" "}
              {formatLeaveDays(absence.days)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
