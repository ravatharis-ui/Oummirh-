"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatFrDateShort } from "@/core/time";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";

import { canAdminDecide, swapStatusMeta } from "../../domain/status";
import { decideSwap } from "../../server/actions";
import type { SwapRow } from "../../types";

/**
 * Les échanges, vus par la direction.
 *
 * Elle n'arrive qu'en second : la collègue a déjà dit oui. Ce qui reste à
 * arbitrer, c'est l'organisation du magasin, pas l'accord entre les deux.
 */
export function SwapList({ swaps }: { swaps: SwapRow[] }) {
  const [comments, setComments] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function decide(id: string, approve: boolean): void {
    setError(null);
    startTransition(async () => {
      const result = await decideSwap(id, approve, comments[id] ?? null);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  if (swaps.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center">
        Aucun échange à traiter.
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
        {swaps.map((swap) => {
          const meta = swapStatusMeta(swap.status);

          return (
            <li key={swap.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {swap.requesterName} ↔ {swap.partnerName}
                  </p>
                  <p className="text-muted-foreground text-sm tabular-nums">
                    {swap.requesterName} cède le {formatFrDateShort(swap.requesterDate)} ·{" "}
                    {swap.partnerName} cède le {formatFrDateShort(swap.partnerDate)}
                  </p>
                </div>
                <Badge variant={meta.badge}>{meta.adminLabel}</Badge>
              </div>

              {swap.message ? <p className="mt-2 text-sm italic">« {swap.message} »</p> : null}

              {canAdminDecide(swap.status) ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input
                    aria-label={`Commentaire pour l'échange de ${swap.requesterName}`}
                    placeholder="Commentaire (facultatif)"
                    className="h-10 max-w-xs"
                    value={comments[swap.id] ?? ""}
                    onChange={(event) =>
                      setComments((current) => ({ ...current, [swap.id]: event.target.value }))
                    }
                  />
                  <Button size="sm" disabled={isPending} onClick={() => decide(swap.id, true)}>
                    <Check className="size-4" aria-hidden />
                    Valider
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => decide(swap.id, false)}
                  >
                    <X className="size-4" aria-hidden />
                    Refuser
                  </Button>
                </div>
              ) : swap.adminComment ? (
                <p className="text-muted-foreground mt-2 text-sm italic">« {swap.adminComment} »</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
