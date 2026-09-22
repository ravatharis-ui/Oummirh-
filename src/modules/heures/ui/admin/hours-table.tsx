"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatDuration } from "@/core/time";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Modal } from "@/core/ui/modal";
import { cn } from "@/core/ui/utils";

import { BALANCE_TONE_CLASS, balanceTone, formatBalance } from "../../domain/recovery";
import { adjustHoursBalance } from "../../server/actions";
import type { HoursMonthRow } from "../../types";

/**
 * Le tableau du mois.
 *
 * La mention sur la paie n'est pas une précaution juridique de façade : ce
 * compteur ne connaît ni majoration ni convention collective, et quelqu'un qui
 * le prendrait pour un décompte d'heures supplémentaires se tromperait.
 */
export function HoursTable({ rows }: { rows: HoursMonthRow[] }) {
  const [adjusting, setAdjusting] = useState<HoursMonthRow | null>(null);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center">
        Aucune collaboratrice active sur ce point de vente.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <caption className="text-muted-foreground mb-2 text-left text-sm">
            Compteur de récupération interne. Aucune majoration légale, aucun calcul de paie.
          </caption>
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="py-2 font-medium">
                Collaboratrice
              </th>
              <th scope="col" className="py-2 font-medium">
                Point de vente
              </th>
              <th scope="col" className="py-2 font-medium">
                Contrat / sem.
              </th>
              <th scope="col" className="py-2 font-medium">
                Planifié
              </th>
              <th scope="col" className="py-2 font-medium">
                Réel
              </th>
              <th scope="col" className="py-2 font-medium">
                Écart du mois
              </th>
              <th scope="col" className="py-2 font-medium">
                Solde cumulé
              </th>
              <th scope="col" className="py-2 font-medium">
                <span className="sr-only">Ajuster</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employeeId} className="border-b last:border-b-0">
                <td className="py-2 font-medium">{row.displayName}</td>
                <td className="text-muted-foreground py-2">{row.boutiqueName}</td>
                <td className="py-2 tabular-nums">
                  {row.contractMinutes === null ? "—" : formatDuration(row.contractMinutes)}
                </td>
                <td className="py-2 tabular-nums">{formatDuration(row.plannedMinutes)}</td>
                <td className="py-2 tabular-nums">{formatDuration(row.workedMinutes)}</td>
                <td
                  className={cn(
                    "py-2 tabular-nums",
                    BALANCE_TONE_CLASS[balanceTone(row.monthMinutes)],
                  )}
                >
                  {formatBalance(row.monthMinutes)}
                </td>
                <td
                  className={cn(
                    "py-2 font-medium tabular-nums",
                    BALANCE_TONE_CLASS[balanceTone(row.balanceMinutes)],
                  )}
                >
                  {formatBalance(row.balanceMinutes)}
                </td>
                <td className="py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setAdjusting(row)}>
                    Ajuster
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adjusting ? <AdjustDialog row={adjusting} onClose={() => setAdjusting(null)} /> : null}
    </>
  );
}

function AdjustDialog({ row, onClose }: { row: HoursMonthRow; onClose: () => void }) {
  const [minutes, setMinutes] = useState("60");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(): void {
    setError(null);
    const parsed = Number(minutes);

    if (!Number.isInteger(parsed)) {
      setError("Indiquez un nombre entier de minutes, par exemple 60 ou -30.");
      return;
    }

    startTransition(async () => {
      const result = await adjustHoursBalance({
        employeeId: row.employeeId,
        minutes: parsed,
        note,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Ajuster le solde — ${row.displayName}`}
      description={`Solde actuel : ${formatBalance(row.balanceMinutes)}`}
    >
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          L&apos;ajustement s&apos;ajoute à l&apos;historique. Un nombre négatif retire des minutes.
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="adjust-minutes">Minutes</Label>
          <Input
            id="adjust-minutes"
            inputMode="numeric"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="adjust-hours-note">Motif</Label>
          <Input
            id="adjust-hours-note"
            value={note}
            maxLength={500}
            placeholder="Samedi travaillé hors planning, erreur de pointage…"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={isPending}>
            Enregistrer l&apos;ajustement
          </Button>
        </div>
      </div>
    </Modal>
  );
}
