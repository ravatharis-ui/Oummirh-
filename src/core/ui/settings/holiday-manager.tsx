"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { removeHoliday, saveHoliday } from "@/core/settings/actions";
import type { HolidayRow } from "@/core/settings/queries";
import { formatFrDateWithYear, todayInReunion } from "@/core/time";

import { Button } from "../button";
import { Input } from "../input";
import { Label } from "../label";

/**
 * Les jours fériés.
 *
 * Pâques et l'Ascension bougent chaque année : sans cet écran, il faudrait un
 * développeur chaque mois de janvier pour que le décompte des congés tombe
 * juste. Le 20 décembre, lui, ne bouge pas — mais il compte autant.
 */
export function HolidayManager({ holidays }: { holidays: HolidayRow[] }) {
  const [date, setDate] = useState(todayInReunion());
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function add(): void {
    setError(null);

    if (!label.trim()) {
      setError("Donnez un nom au jour férié.");
      return;
    }

    startTransition(async () => {
      const result = await saveHoliday(date, label.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setLabel("");
      router.refresh();
    });
  }

  function remove(target: string): void {
    setError(null);
    startTransition(async () => {
      const result = await removeHoliday(target);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Un jour férié n&apos;est jamais décompté des congés. Seuls les jours à venir sont listés :
        un congé déjà validé garde le décompte arrêté le jour de la décision.
      </p>

      {holidays.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-center text-sm text-amber-800">
          Aucun jour férié à venir n&apos;est enregistré. Le décompte des congés comptera ces
          journées comme des jours ordinaires.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {holidays.map((holiday) => (
            <li
              key={holiday.date}
              className="flex items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div>
                <p className="font-medium">{holiday.label}</p>
                <p className="text-muted-foreground text-sm capitalize">
                  {formatFrDateWithYear(holiday.date)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => remove(holiday.date)}
              >
                <Trash2 className="size-4" aria-hidden />
                Retirer
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border p-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="holiday-date">Date</Label>
          <Input
            id="holiday-date"
            type="date"
            className="w-44"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="holiday-label">Nom</Label>
          <Input
            id="holiday-label"
            placeholder="Lundi de Pâques"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>

        <Button size="sm" onClick={add} disabled={isPending}>
          <Plus className="size-4" aria-hidden />
          Ajouter
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
