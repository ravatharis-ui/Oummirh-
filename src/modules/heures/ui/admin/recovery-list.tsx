"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatDuration, formatFrDate } from "@/core/time";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";

import { RECOVERY_MODE_LABELS } from "../../domain/recovery";
import { decideRecovery } from "../../server/actions";
import type { RecoveryRequestRow } from "../../types";

/** Valider en un clic : c'est tout l'intérêt, sinon personne ne le fait. */
export function RecoveryList({ requests }: { requests: RecoveryRequestRow[] }) {
  const [comments, setComments] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function decide(id: string, approve: boolean): void {
    setError(null);
    startTransition(async () => {
      const result = await decideRecovery(id, approve, comments[id] ?? null);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  if (requests.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center">
        Aucune demande de récupération en attente.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {requests.map((request) => (
          <li
            key={request.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
          >
            <div>
              <p className="font-medium">{request.displayName}</p>
              <p className="text-muted-foreground text-sm">
                {RECOVERY_MODE_LABELS[request.mode]} de {formatDuration(request.minutes)} —{" "}
                {formatFrDate(request.date)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
                Accorder
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
          </li>
        ))}
      </ul>
    </div>
  );
}
