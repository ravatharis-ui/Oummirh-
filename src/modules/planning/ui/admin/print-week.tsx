import {
  formatDuration,
  formatFrDateShort,
  formatFrDateWithYear,
  type DateString,
} from "@/core/time";

import { statusMeta } from "../../domain/status";
import type { PlanningWeek } from "../../types";

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/**
 * The printable week, A4 landscape.
 *
 * Colours are kept but never relied on: every cell also carries its label in
 * words, because the copy pinned in the back office comes out of a black and
 * white printer.
 */
export function PrintWeek({ week }: { week: PlanningWeek }) {
  const lastDate: DateString = week.dates[week.dates.length - 1] ?? week.weekStart;

  return (
    <div className="print-week mx-auto max-w-[297mm] p-6 text-[11px] text-black">
      <style>{`@page { size: A4 landscape; margin: 10mm; }
        @media print { .print-hidden { display: none !important; } body { background: white; } }`}</style>

      <header className="mb-3 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">
          Planning — semaine du {formatFrDateShort(week.weekStart)} au {formatFrDateShort(lastDate)}
        </h1>
        <p className="text-[10px]">
          {week.boutiques.find((boutique) => boutique.id === week.boutiqueId)?.name ??
            "Tous les points de vente"}
        </p>
      </header>

      <table className="w-full border-collapse">
        <caption className="sr-only">
          Planning de la semaine du {formatFrDateWithYear(week.weekStart)}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="border border-neutral-400 p-1 text-left">
              Collaboratrice
            </th>
            {week.dates.map((date, index) => (
              <th key={date} scope="col" className="border border-neutral-400 p-1">
                {DAY_LABELS[index]} {formatFrDateShort(date).slice(0, 5)}
              </th>
            ))}
            <th scope="col" className="border border-neutral-400 p-1">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {week.rows.map((row) => (
            <tr key={row.employeeId}>
              <th scope="row" className="border border-neutral-400 p-1 text-left font-medium">
                {row.displayName}
              </th>
              {week.dates.map((date) => {
                const entry = row.days[date];
                if (!entry) {
                  return <td key={date} className="border border-neutral-400 p-1 text-center" />;
                }

                const meta = statusMeta(entry.status);
                return (
                  <td key={date} className="border border-neutral-400 p-1 text-center align-top">
                    <span className="block font-medium">{meta.short}</span>
                    {entry.startTime && entry.endTime ? (
                      <span className="block tabular-nums">
                        {entry.startTime.slice(0, 5)}–{entry.endTime.slice(0, 5)}
                      </span>
                    ) : null}
                  </td>
                );
              })}
              <td className="border border-neutral-400 p-1 text-center font-medium">
                {formatDuration(row.plannedMinutes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
