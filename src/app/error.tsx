"use client";

import { RotateCw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/core/ui/button";

/**
 * Turns a crash into something a salesperson can act on, and something the
 * direction can report. Next hides the real message in production, so the digest
 * is surfaced: it is the only thread back to the server log.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] Erreur non rattrapée", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Une erreur est survenue</h1>
        <p className="text-muted-foreground mt-2 text-base">
          Réessayez dans un instant. Si le problème persiste, prévenez la direction.
        </p>
      </div>

      <Button onClick={reset} size="lg">
        <RotateCw className="size-5" aria-hidden /> Réessayer
      </Button>

      {error.digest ? (
        <p className="text-muted-foreground font-mono text-xs">Référence : {error.digest}</p>
      ) : null}
    </main>
  );
}
