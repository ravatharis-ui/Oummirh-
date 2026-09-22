"use client";

import { PencilLine } from "lucide-react";
import { useState } from "react";

import { formatDuration, formatFrDateShort, toReunionTimeString } from "@/core/time";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { cn } from "@/core/ui/utils";

import { DELTA_TONE_CLASS, deltaTone, formatDelta } from "../../domain/delta";
import type { HistoryRow } from "../../types";

import { CorrectionDialog } from "./correction-dialog";

function hhmm(instant: string | null): string {
  return instant ? toReunionTimeString(new Date(instant)) : "—";
}

/**
 * The history.
 *
 * Deltas are coloured *and* spelled out: a printed page, a colour-blind reader
 * and a phone in the sun all have to be able to tell a late arrival from an
 * early one.
 */
export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  const [correcting, setCorrecting] = useState<HistoryRow | null>(null);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center">
        Aucun pointage sur cette période.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <caption className="sr-only">Historique des pointages</caption>
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="py-2 font-medium">
                Date
              </th>
              <th scope="col" className="py-2 font-medium">
                Collaboratrice
              </th>
              <th scope="col" className="py-2 font-medium">
                Arrivée
              </th>
              <th scope="col" className="py-2 font-medium">
                Pause
              </th>
              <th scope="col" className="py-2 font-medium">
                Départ
              </th>
              <th scope="col" className="py-2 font-medium">
                Travaillé
              </th>
              <th scope="col" className="py-2 font-medium">
                <span className="sr-only">Corriger</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const tone = deltaTone(row.arrivalDeltaMinutes);

              return (
                <tr key={`${row.employeeId}:${row.localDate}`} className="border-b last:border-b-0">
                  <td className="py-2 tabular-nums">{formatFrDateShort(row.localDate)}</td>
                  <td className="py-2 font-medium">
                    {row.displayName}
                    {row.hasCorrection ? (
                      <Badge variant="outline" className="ml-2">
                        corrigé
                      </Badge>
                    ) : null}
                  </td>
                  <td className={cn("py-2 tabular-nums", DELTA_TONE_CLASS[tone])}>
                    {hhmm(row.clockInAt)}
                    {row.arrivalDeltaMinutes !== null ? (
                      <span className="block text-xs">{formatDelta(row.arrivalDeltaMinutes)}</span>
                    ) : null}
                  </td>
                  <td className="py-2 tabular-nums">
                    {row.breakStartAt ? `${hhmm(row.breakStartAt)} – ${hhmm(row.breakEndAt)}` : "—"}
                  </td>
                  <td className="py-2 tabular-nums">{hhmm(row.clockOutAt)}</td>
                  <td className="py-2 tabular-nums">
                    {row.workedMinutes === null ? (
                      <span className="text-amber-700">journée non close</span>
                    ) : (
                      formatDuration(row.workedMinutes)
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setCorrecting(row)}>
                      <PencilLine className="size-4" aria-hidden />
                      Corriger
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {correcting ? (
        <CorrectionDialog row={correcting} onClose={() => setCorrecting(null)} />
      ) : null}
    </>
  );
}
