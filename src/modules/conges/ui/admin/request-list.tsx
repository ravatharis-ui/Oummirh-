"use client";

import { Check, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatFrDateShort } from "@/core/time";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";

import { formatLeaveDays, LEAVE_STATUS_LABELS } from "../../domain/count";
import { decideLeaveRequest } from "../../server/actions";
import type { LeaveOverlap, LeaveRequestRow } from "../../types";

const STATUS_VARIANT = {
  pending: "warning",
  approved: "success",
  refused: "danger",
  cancelled: "outline",
} as const;

interface RequestListProps {
  requests: LeaveRequestRow[];
  /** Les chevauchements déjà résolus côté serveur, par identifiant de demande. */
  overlaps: Record<string, LeaveOverlap[]>;
}

/**
 * Les demandes, vues par la direction.
 *
 * Le chevauchement est affiché avec la demande, pas caché derrière un clic :
 * c'est l'information qui décide, et la chercher après coup revient à ne jamais
 * la chercher.
 */
export function RequestList({ requests, overlaps }: RequestListProps) {
  const [comments, setComments] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function decide(id: string, approve: boolean): void {
    setError(null);
    startTransition(async () => {
      const result = await decideLeaveRequest(id, approve, comments[id] ?? null);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  if (requests.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center">
        Aucune demande de congé.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {requests.map((request) => {
          const conflicts = overlaps[request.id] ?? [];

          return (
            <li key={request.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{request.displayName}</p>
                  <p className="text-muted-foreground text-sm">
                    {formatFrDateShort(request.startDate)} → {formatFrDateShort(request.endDate)} ·{" "}
                    {formatLeaveDays(request.days)}
                    {request.startHalf === "pm" ? " · départ l'après-midi" : ""}
                    {request.endHalf === "am" ? " · retour l'après-midi" : ""}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[request.status]}>
                  {LEAVE_STATUS_LABELS[request.status]}
                </Badge>
              </div>

              {request.reason ? <p className="mt-2 text-sm">« {request.reason} »</p> : null}

              {conflicts.length > 0 ? (
                <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                  Déjà absente sur ces dates, même point de vente :{" "}
                  {conflicts.map((conflict) => conflict.displayName).join(", ")}.
                </p>
              ) : null}

              {request.status === "pending" ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input
                    aria-label={`Commentaire pour ${request.displayName}`}
                    placeholder="Commentaire (facultatif)"
                    className="h-10 max-w-xs"
                    value={comments[request.id] ?? ""}
                    onChange={(event) =>
                      setComments((current) => ({ ...current, [request.id]: event.target.value }))
                    }
                  />
                  <Button size="sm" disabled={isPending} onClick={() => decide(request.id, true)}>
                    <Check className="size-4" aria-hidden />
                    Valider
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => decide(request.id, false)}
                  >
                    <X className="size-4" aria-hidden />
                    Refuser
                  </Button>
                </div>
              ) : request.adminComment ? (
                <p className="text-muted-foreground mt-2 text-sm italic">
                  « {request.adminComment} »
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
