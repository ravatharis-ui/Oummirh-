"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createBrowserSupabaseClient } from "@/core/db/client";
import { formatFrDateShort, todayInReunion, type DateString } from "@/core/time";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";

import { REPLACEMENT_STATUS_LABELS } from "../../domain/availability";
import { cancelReplacement } from "../../server/actions";
import type { Candidate, ReplacementRow } from "../../types";

import { ReplacementWizard } from "./replacement-wizard";

interface ReplacementListProps {
  replacements: ReplacementRow[];
  boutiques: { id: string; name: string }[];
  defaultStart: string;
  defaultEnd: string;
}

/**
 * L'historique et le bouton.
 *
 * Les candidates sont chargées depuis le navigateur au moment où on en a besoin,
 * parce qu'elles dépendent de la date et du point de vente que la direction
 * vient de choisir. La fonction appelée est `security definer` et revérifie le
 * rôle : la question « qui est en congé » ne peut pas fuir par ce chemin.
 */
export function ReplacementList({
  replacements,
  boutiques,
  defaultStart,
  defaultEnd,
}: ReplacementListProps) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function loadCandidates(date: DateString, boutiqueId: string): Promise<void> {
    setLoading(true);
    setCandidates([]);

    const supabase = createBrowserSupabaseClient();
    const { data, error: rpcError } = await supabase.rpc("admin_replacement_candidates", {
      p_date: date,
      p_boutique_id: boutiqueId,
    });

    if (rpcError) {
      console.error("[remplacements] Disponibilités indisponibles", rpcError.message);
      setError("Impossible de charger les disponibilités. Réessayez.");
    } else {
      setCandidates(
        (data ?? []).map((row) => ({
          employeeId: row.employee_id,
          displayName: row.display_name,
          homeBoutique: row.home_boutique,
          availability: row.availability as Candidate["availability"],
          plannedStatus: row.planned_status,
          plannedStart: row.planned_start,
          plannedEnd: row.planned_end,
          plannedShop: row.planned_shop,
        })),
      );
    }

    setLoading(false);
  }

  function cancel(id: string): void {
    setError(null);
    startTransition(async () => {
      const result = await cancelReplacement(id);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  const today = todayInReunion();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Remplacements</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Remplacement direct
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {replacements.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center">
          Aucun remplacement organisé ces deux derniers mois.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {replacements.map((replacement) => (
            <li
              key={replacement.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div>
                <p className="font-medium">
                  {replacement.displayName} → {replacement.boutiqueName}
                </p>
                <p className="text-muted-foreground text-sm tabular-nums">
                  {formatFrDateShort(replacement.date)} · {replacement.startTime.slice(0, 5)} –{" "}
                  {replacement.endTime.slice(0, 5)}
                  {replacement.note ? ` · ${replacement.note}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {replacement.status === "cancelled" ? (
                  <Badge variant="outline">{REPLACEMENT_STATUS_LABELS.cancelled}</Badge>
                ) : (
                  <Badge variant="success">{REPLACEMENT_STATUS_LABELS.active}</Badge>
                )}

                {replacement.status === "active" && replacement.date >= today ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => cancel(replacement.id)}
                  >
                    Annuler
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <ReplacementWizard
          boutiques={boutiques}
          defaultStart={defaultStart}
          defaultEnd={defaultEnd}
          candidates={candidates}
          isLoadingCandidates={loading}
          onQueryChange={(date, boutiqueId) => void loadCandidates(date, boutiqueId)}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
