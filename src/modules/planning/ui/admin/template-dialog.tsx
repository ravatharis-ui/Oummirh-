"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Modal } from "@/core/ui/modal";
import { Select } from "@/core/ui/select";

import { PLANNING_STATUSES, PLANNING_STATUS_META, type PlanningStatus } from "../../domain/status";
import { applyTemplate, clearTemplateDay, saveTemplateDay } from "../../server/actions";
import type { TemplateDay } from "../../server/queries";

const WEEKDAYS = [
  [1, "Lundi"],
  [2, "Mardi"],
  [3, "Mercredi"],
  [4, "Jeudi"],
  [5, "Vendredi"],
  [6, "Samedi"],
  [7, "Dimanche"],
] as const;

interface TemplateDialogProps {
  employeeId: string;
  employeeName: string;
  weekStart: string;
  template: TemplateDay[];
  onClose: () => void;
}

/**
 * La semaine type d'une collaboratrice.
 *
 * Elle décrit une habitude — « le mercredi, elle est à l'école » — et ne touche
 * à aucun planning par elle-même. C'est « Appliquer » qui la pose sur une
 * semaine, et seulement sur ses journées vides : une semaine déjà arbitrée ne
 * se fait pas écraser par une habitude.
 */
export function TemplateDialog({
  employeeId,
  employeeName,
  weekStart,
  template,
  onClose,
}: TemplateDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const byWeekday = new Map(template.map((day) => [day.weekday, day]));

  function setDay(weekday: number, status: string): void {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result =
        status === ""
          ? await clearTemplateDay(employeeId, weekday)
          : await saveTemplateDay(employeeId, weekday, status);

      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function setTimes(weekday: number, status: string, startTime: string, endTime: string): void {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await saveTemplateDay(employeeId, weekday, status, { startTime, endTime });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function apply(): void {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await applyTemplate(employeeId, weekStart);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage(
        result.data.applied === 0
          ? "Rien à remplir : toutes les journées de cette semaine sont déjà renseignées."
          : `${result.data.applied} journée${result.data.applied > 1 ? "s" : ""} remplie${
              result.data.applied > 1 ? "s" : ""
            }.`,
      );
      router.refresh();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Semaine type — ${employeeName}`}
      description="Une habitude, pas un planning. Elle ne change rien tant qu'on ne l'applique pas."
      className="w-[min(36rem,calc(100vw-2rem))]"
    >
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {WEEKDAYS.map(([weekday, label]) => {
            const day = byWeekday.get(weekday);
            const needsHours = day
              ? PLANNING_STATUS_META[(day.status as PlanningStatus) ?? "work"]?.needsHours
              : false;

            return (
              <li key={weekday} className="flex flex-wrap items-center gap-2">
                <span className="w-24 text-sm font-medium">{label}</span>

                <Select
                  aria-label={`${label} — type de journée`}
                  className="h-10 w-44"
                  value={day?.status ?? ""}
                  disabled={isPending}
                  onChange={(event) => setDay(weekday, event.target.value)}
                >
                  <option value="">Non renseigné</option>
                  {PLANNING_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {PLANNING_STATUS_META[status].label}
                    </option>
                  ))}
                </Select>

                {day && needsHours ? (
                  <span className="flex items-center gap-2">
                    <Input
                      aria-label={`${label} — début`}
                      type="time"
                      className="h-10 w-28"
                      defaultValue={day.startTime?.slice(0, 5) ?? ""}
                      disabled={isPending}
                      onBlur={(event) =>
                        setTimes(
                          weekday,
                          day.status,
                          event.target.value,
                          day.endTime?.slice(0, 5) ?? "",
                        )
                      }
                    />
                    <Input
                      aria-label={`${label} — fin`}
                      type="time"
                      className="h-10 w-28"
                      defaultValue={day.endTime?.slice(0, 5) ?? ""}
                      disabled={isPending}
                      onBlur={(event) =>
                        setTimes(
                          weekday,
                          day.status,
                          day.startTime?.slice(0, 5) ?? "",
                          event.target.value,
                        )
                      }
                    />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm">
            Appliquer ne remplit que les journées vides de la semaine affichée.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isPending}>
              Fermer
            </Button>
            <Button onClick={apply} disabled={isPending || template.length === 0}>
              Appliquer à cette semaine
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
