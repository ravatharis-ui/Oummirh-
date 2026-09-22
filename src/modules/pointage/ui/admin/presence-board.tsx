"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { createBrowserSupabaseClient } from "@/core/db/client";
import { formatDuration, toReunionTimeString, type DateString } from "@/core/time";
import { Badge } from "@/core/ui/badge";
import { cn } from "@/core/ui/utils";

import { DELTA_TONE_CLASS, deltaTone, formatDelta } from "../../domain/delta";
import type { PresenceRow } from "../../types";

/** What a collaboratrice's day currently looks like, in one word. */
function stateOf(row: PresenceRow): {
  label: string;
  variant: "default" | "success" | "warning" | "outline";
} {
  if (row.plannedStatus && row.plannedStatus !== "work" && row.plannedStatus !== "replacement") {
    return { label: "Non prévue", variant: "outline" };
  }
  if (row.last === null) return { label: "Pas encore arrivée", variant: "warning" };
  if (row.last === "clock_out") return { label: "Partie", variant: "outline" };
  if (row.last === "break_start") return { label: "En pause", variant: "default" };
  return { label: "Présente", variant: "success" };
}

/**
 * The live board.
 *
 * Rendered on the server, then kept fresh by Realtime: a pointing on a phone in
 * Saint-Pierre updates this screen without anyone pressing anything. The refresh
 * goes through the server so the row stays subject to the same Row Level
 * Security as the first render.
 */
export function PresenceBoard({ rows, date }: { rows: PresenceRow[]; date: DateString }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const router = useRouter();

  useEffect(() => {
    const channel = supabase
      .channel(`presence:${date}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_clocks", filter: `local_date=eq.${date}` },
        // The refresh goes back through the server, so the new row is read under
        // the same Row Level Security as the first render.
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, date, router]);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center">
        Aucune collaboratrice active.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] text-sm">
        <caption className="sr-only">Présence du jour</caption>
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="py-2 font-medium">
              Collaboratrice
            </th>
            <th scope="col" className="py-2 font-medium">
              Point de vente
            </th>
            <th scope="col" className="py-2 font-medium">
              Prévu
            </th>
            <th scope="col" className="py-2 font-medium">
              Arrivée
            </th>
            <th scope="col" className="py-2 font-medium">
              Départ
            </th>
            <th scope="col" className="py-2 font-medium">
              Travaillé
            </th>
            <th scope="col" className="py-2 font-medium">
              État
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const state = stateOf(row);
            const tone = deltaTone(row.arrivalDeltaMinutes);

            return (
              <tr key={row.employeeId} className="border-b last:border-b-0">
                <td className="py-2 font-medium">{row.displayName}</td>
                <td className="text-muted-foreground py-2">{row.boutiqueName}</td>
                <td className="py-2 tabular-nums">
                  {row.plannedStart && row.plannedEnd
                    ? `${row.plannedStart.slice(0, 5)} – ${row.plannedEnd.slice(0, 5)}`
                    : "—"}
                </td>
                <td className={cn("py-2 tabular-nums", DELTA_TONE_CLASS[tone])}>
                  {row.clockInAt ? (
                    <>
                      {toReunionTimeString(new Date(row.clockInAt))}
                      {row.arrivalDeltaMinutes !== null ? (
                        <span className="block text-xs">
                          {formatDelta(row.arrivalDeltaMinutes)}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 tabular-nums">
                  {row.clockOutAt ? toReunionTimeString(new Date(row.clockOutAt)) : "—"}
                </td>
                <td className="py-2 tabular-nums">
                  {row.workedMinutes === null ? "—" : formatDuration(row.workedMinutes)}
                </td>
                <td className="py-2">
                  <Badge variant={state.variant}>{state.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
