"use client";

import {
  CircleCheck,
  CircleX,
  LoaderCircle,
  Play,
  RefreshCw,
  Send,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import type { ActionResult } from "@/core/actions";
import { formatRelativeFr } from "@/core/time";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/ui/card";

import {
  listDemoEvents,
  sendDemoNotification,
  triggerDemoFailure,
  type DemoEventRow,
} from "../../server/actions";

interface DiagnosticsPanelProps {
  /**
   * Injected by the page. Running a pass requires the registry, which only the
   * application layer can build: a module must never reach upwards.
   */
  onDispatch: () => Promise<ActionResult<{ claimed: number; processed: number; failed: number }>>;
}

const MAX_ATTEMPTS = 5;

export function DiagnosticsPanel({ onDispatch }: DiagnosticsPanelProps) {
  const [events, setEvents] = useState<DemoEventRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = () => {
    startTransition(async () => {
      setEvents(await listDemoEvents());
    });
  };

  useEffect(refresh, []);

  const run = (action: () => Promise<ActionResult<unknown>>, success: string) => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) setMessage(success);
      else setError(result.error);
      setEvents(await listDemoEvents());
    });
  };

  const dispatch = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await onDispatch();
      if (result.ok) {
        const { claimed, processed, failed } = result.data;
        setMessage(
          claimed === 0
            ? "Rien à traiter : la file est vide."
            : `${claimed} événement(s) pris, ${processed} traité(s), ${failed} en échec.`,
        );
      } else {
        setError(result.error);
      }
      setEvents(await listDemoEvents());
    });
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="text-base">Vérifier la chaîne des événements</CardTitle>
        <CardDescription>
          Un événement est inscrit en base, puis repris par le distributeur, qui déclenche la
          notification. En production, le webhook Supabase lance une passe dès l&apos;inscription.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() =>
              run(
                sendDemoNotification,
                "Événement inscrit. Traitez la file pour voir la notification.",
              )
            }
            disabled={pending}
          >
            <Send className="size-5" aria-hidden /> Envoyer une notification de test
          </Button>

          <Button
            variant="outline"
            onClick={() =>
              run(triggerDemoFailure, "Événement en échec inscrit. Traitez la file plusieurs fois.")
            }
            disabled={pending}
          >
            <TriangleAlert className="size-5" aria-hidden /> Déclencher un échec volontaire
          </Button>

          <Button variant="secondary" onClick={dispatch} disabled={pending}>
            {pending ? (
              <LoaderCircle className="size-5 animate-spin" aria-hidden />
            ) : (
              <Play className="size-5" aria-hidden />
            )}
            Traiter la file maintenant
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            disabled={pending}
            aria-label="Rafraîchir"
          >
            <RefreshCw className="size-5" aria-hidden />
          </Button>
        </div>

        <p role="status" aria-live="polite" className="min-h-6 text-sm">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : (
            <span className="text-muted-foreground">{message}</span>
          )}
        </p>

        {events.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
            Aucun événement de démonstration pour le moment.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-sm"
              >
                {event.processed ? (
                  <CircleCheck className="size-5 shrink-0 text-emerald-600" aria-hidden />
                ) : event.attempts >= MAX_ATTEMPTS ? (
                  <CircleX className="text-destructive size-5 shrink-0" aria-hidden />
                ) : (
                  <LoaderCircle className="text-muted-foreground size-5 shrink-0" aria-hidden />
                )}

                <code className="font-mono">{event.type}</code>

                <Badge
                  variant={
                    event.processed
                      ? "success"
                      : event.attempts >= MAX_ATTEMPTS
                        ? "danger"
                        : "outline"
                  }
                >
                  {event.processed
                    ? "traité"
                    : event.attempts >= MAX_ATTEMPTS
                      ? "abandonné"
                      : `tentative ${event.attempts}/${MAX_ATTEMPTS}`}
                </Badge>

                <span className="text-muted-foreground">{formatRelativeFr(event.createdAt)}</span>

                {event.lastError ? (
                  <span className="text-destructive w-full">{event.lastError}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <p className="text-muted-foreground text-sm">
          Un événement est retenté au plus {MAX_ATTEMPTS} fois. Au-delà, il est abandonné avec son
          motif, plutôt que de tourner en boucle.
        </p>
      </CardContent>
    </Card>
  );
}
