"use client";

import { GraduationCap, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { formatDuration, formatFrDateShort, isoWeekday, type DateString } from "@/core/time";
import { cn } from "@/core/ui/utils";

import { isProtectedSource, statusMeta } from "../../domain/status";
import type { PlanningEntry, PlanningRow, PlanningWeek } from "../../types";

import { EntryPanel } from "./entry-panel";

const DAY_LABELS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

interface Selection {
  row: PlanningRow;
  date: DateString;
  entry: PlanningEntry | null;
}

/**
 * The weekly matrix: one row per collaboratrice, one column per day.
 *
 * Clicking a cell opens the side panel rather than editing in place. A planning
 * day carries four times and a status; trying to fit that inside a table cell
 * would produce something unusable on the one screen the direction actually
 * works from.
 */
export function PlanningGrid({ week }: { week: PlanningWeek }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function close(changed: boolean): void {
    setSelection(null);
    if (changed) startTransition(() => router.refresh());
  }

  if (week.rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center">
        Aucune collaboratrice active sur ce point de vente.
      </p>
    );
  }

  return (
    <div className="relative">
      {isPending ? (
        <div className="bg-background/60 absolute inset-0 z-10 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin" aria-hidden />
          <span className="sr-only">Mise à jour du planning</span>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[60rem] border-separate border-spacing-1 text-sm">
          <caption className="sr-only">
            Planning de la semaine du {formatFrDateShort(week.weekStart)}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-48 text-left font-medium">
                Collaboratrice
              </th>
              {week.dates.map((date, index) => (
                <th key={date} scope="col" className="text-center font-medium">
                  <span className="block capitalize">{DAY_LABELS[index]}</span>
                  <span className="text-muted-foreground block text-xs font-normal">
                    {formatFrDateShort(date).slice(0, 5)}
                  </span>
                </th>
              ))}
              <th scope="col" className="w-28 text-right font-medium">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {week.rows.map((row) => (
              <tr key={row.employeeId}>
                <th scope="row" className="text-left align-middle font-medium">
                  <span className="block">{row.displayName}</span>
                  <span className="text-muted-foreground block text-xs font-normal">
                    {row.boutiqueName}
                  </span>
                </th>

                {week.dates.map((date) => (
                  <td key={date} className="p-0 align-top">
                    <PlanningCell
                      entry={row.days[date] ?? null}
                      weekend={isoWeekday(date) >= 6}
                      onSelect={() => setSelection({ row, date, entry: row.days[date] ?? null })}
                    />
                  </td>
                ))}

                <td className="text-right align-middle">
                  <span className="block font-medium">{formatDuration(row.plannedMinutes)}</span>
                  {row.balanceMinutes !== null ? (
                    <span
                      className={cn(
                        "block text-xs",
                        row.balanceMinutes === 0
                          ? "text-muted-foreground"
                          : row.balanceMinutes > 0
                            ? "text-emerald-700"
                            : "text-amber-700",
                      )}
                    >
                      {row.balanceMinutes > 0 ? "+" : ""}
                      {formatDuration(row.balanceMinutes)} / contrat
                    </span>
                  ) : (
                    <span className="text-muted-foreground block text-xs">
                      contrat non renseigné
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selection ? (
        <EntryPanel
          employeeId={selection.row.employeeId}
          employeeName={selection.row.displayName}
          date={selection.date}
          entry={selection.entry}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

function PlanningCell({
  entry,
  weekend,
  onSelect,
}: {
  entry: PlanningEntry | null;
  weekend: boolean;
  onSelect: () => void;
}) {
  if (!entry) {
    return (
      <Button
        variant="ghost"
        onClick={onSelect}
        className={cn(
          "text-muted-foreground h-16 w-full rounded-lg border border-dashed text-sm font-normal",
          weekend && "bg-muted/40",
        )}
      >
        <Plus className="size-4" aria-hidden />
        <span className="sr-only">Renseigner cette journée</span>
      </Button>
    );
  }

  const meta = statusMeta(entry.status);
  const locked = isProtectedSource(entry.source);

  return (
    <Button
      variant="ghost"
      onClick={onSelect}
      className={cn(
        "h-16 w-full flex-col items-start gap-0.5 rounded-lg border px-2 py-1 text-left font-normal",
        meta.cell,
      )}
    >
      <span className="flex w-full items-center gap-1 text-xs font-medium">
        {entry.status === "school" ? <GraduationCap className="size-3.5" aria-hidden /> : null}
        {meta.short}
      </span>
      {entry.startTime && entry.endTime ? (
        <span className="text-xs tabular-nums">
          {entry.startTime.slice(0, 5)} – {entry.endTime.slice(0, 5)}
        </span>
      ) : null}
      {locked ? (
        <Badge variant="outline" className="mt-auto px-1 py-0 text-[0.65rem]">
          posé automatiquement
        </Badge>
      ) : null}
    </Button>
  );
}
