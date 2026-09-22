"use client";

import { ChevronLeft, ChevronRight, Copy, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UrlObject } from "node:url";
import { useState, useTransition } from "react";

import { Button } from "@/core/ui/button";
import { Select } from "@/core/ui/select";
import { addDays, formatFrDateShort, type DateString } from "@/core/time";

import { duplicateWeek } from "../../server/actions";
import type { PlanningWeek } from "../../types";

/**
 * Links are built as URL objects rather than strings.
 *
 * `typedRoutes` checks the pathname against the routes that actually exist, and a
 * hand-assembled string would defeat exactly the check that catches a menu entry
 * pointing nowhere.
 */
function weekHref(
  pathname: "/admin/planning" | "/admin/planning/impression",
  week: DateString,
  boutiqueId: string | null,
): UrlObject {
  return {
    pathname,
    query: boutiqueId ? { week, boutique: boutiqueId } : { week },
  };
}

export function WeekToolbar({ week }: { week: PlanningWeek }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const previous = addDays(week.weekStart, -7);
  const next = addDays(week.weekStart, 7);
  const lastDate = week.dates[week.dates.length - 1] ?? week.weekStart;

  function copyFromPreviousWeek(): void {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await duplicateWeek(previous, week.weekStart);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage(
        result.data.copied === 0
          ? "Rien à copier : la semaine précédente est vide."
          : `${result.data.copied} journée${result.data.copied > 1 ? "s" : ""} copiée${
              result.data.copied > 1 ? "s" : ""
            }. Les congés et remplacements déjà posés n'ont pas été touchés.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={weekHref("/admin/planning", previous, week.boutiqueId)}>
            <ChevronLeft className="size-4" aria-hidden />
            Semaine précédente
          </Link>
        </Button>

        <span className="px-2 font-medium">
          Semaine du {formatFrDateShort(week.weekStart)} au {formatFrDateShort(lastDate)}
        </span>

        <Button variant="outline" size="sm" asChild>
          <Link href={weekHref("/admin/planning", next, week.boutiqueId)}>
            Semaine suivante
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </Button>

        {/* A plain GET form: the filter still works if JavaScript never loads. */}
        <form action="/admin/planning" method="get" className="contents">
          <input type="hidden" name="week" value={week.weekStart} />
          <Select
            name="boutique"
            aria-label="Point de vente"
            className="h-10 w-auto"
            defaultValue={week.boutiqueId ?? ""}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          >
            <option value="">Tous les points de vente</option>
            {week.boutiques.map((boutique) => (
              <option key={boutique.id} value={boutique.id}>
                {boutique.name}
              </option>
            ))}
          </Select>
          <noscript>
            <Button type="submit" variant="outline" size="sm">
              Filtrer
            </Button>
          </noscript>
        </form>

        <Button variant="secondary" size="sm" onClick={copyFromPreviousWeek} disabled={isPending}>
          <Copy className="size-4" aria-hidden />
          Copier la semaine précédente
        </Button>

        <Button variant="outline" size="sm" asChild>
          <Link
            href={weekHref("/admin/planning/impression", week.weekStart, week.boutiqueId)}
            target="_blank"
          >
            <Printer className="size-4" aria-hidden />
            Imprimer
          </Link>
        </Button>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
