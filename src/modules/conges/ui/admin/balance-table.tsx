"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Modal } from "@/core/ui/modal";
import { cn } from "@/core/ui/utils";

import { formatLeaveDays } from "../../domain/count";
import { adjustLeaveBalance } from "../../server/actions";
import type { LeaveBalanceRow } from "../../types";

export function BalanceTable({
  rows,
  periodLabel,
}: {
  rows: LeaveBalanceRow[];
  periodLabel: string;
}) {
  const [adjusting, setAdjusting] = useState<LeaveBalanceRow | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <caption className="text-muted-foreground mb-2 text-left text-sm">
            Soldes de la période {periodLabel}
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
                Solde
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
                <td className={cn("py-2 tabular-nums", row.balance < 0 && "text-amber-700")}>
                  {formatLeaveDays(row.balance)}
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

/**
 * Ajuster un solde.
 *
 * L'ajustement s'ajoute au ledger, il ne le remplace pas : le solde reste la
 * somme de ce qui s'est passé, et le motif dit pourquoi il a bougé.
 */
function AdjustDialog({ row, onClose }: { row: LeaveBalanceRow; onClose: () => void }) {
  const [days, setDays] = useState("1");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(): void {
    setError(null);
    const parsed = Number(days.replace(",", "."));

    if (!Number.isFinite(parsed)) {
      setError("Indiquez un nombre de jours, par exemple 1 ou -0,5.");
      return;
    }

    startTransition(async () => {
      const result = await adjustLeaveBalance({
        employeeId: row.employeeId,
        days: parsed,
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
      description={`Solde actuel : ${formatLeaveDays(row.balance)}`}
    >
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          L&apos;ajustement s&apos;ajoute à l&apos;historique. Un nombre négatif retire des jours.
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="adjust-days">Jours</Label>
          <Input
            id="adjust-days"
            inputMode="decimal"
            value={days}
            onChange={(event) => setDays(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="adjust-note">Motif</Label>
          <Input
            id="adjust-note"
            value={note}
            maxLength={500}
            placeholder="Reprise d'ancienneté, erreur de saisie…"
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
