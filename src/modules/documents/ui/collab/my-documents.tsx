"use client";

import { Download, FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatFrDateShort } from "@/core/time";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/ui/card";

import { categoryMeta, DOCUMENT_CATEGORIES, periodLabel } from "../../domain/categories";
import { formatFileSize } from "../../domain/file";
import { openDocument } from "../../server/actions";
import type { DocumentRow } from "../../types";

/**
 * Le coffre, côté collaboratrice.
 *
 * Classé par catégorie, et les fiches de paie par année : c'est comme ça qu'on
 * cherche un bulletin — « celui de septembre dernier », pas « le douzième ».
 *
 * Le lien de téléchargement est demandé au moment du clic et vaut soixante
 * secondes. Il n'existe donc jamais de lien à recopier ou à transmettre.
 */
export function MyDocuments({ documents }: { documents: DocumentRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function open(id: string): void {
    setError(null);
    setPendingId(id);

    startTransition(async () => {
      const result = await openDocument(id);
      setPendingId(null);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      window.open(result.data.url, "_blank", "noopener,noreferrer");
      router.refresh();
    });
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground text-base">
            Ton coffre est vide pour l&apos;instant. Tes fiches de paie et tes documents
            apparaîtront ici dès que la direction les aura déposés.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className="text-destructive text-base">
          {error}
        </p>
      ) : null}

      {DOCUMENT_CATEGORIES.map((category) => {
        const rows = documents.filter((document) => document.category === category);
        if (rows.length === 0) return null;

        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-base">{categoryMeta(category).plural}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {rows.map((document) => (
                  <li
                    key={document.id}
                    className="flex items-center justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <FileText
                        className="text-muted-foreground mt-1 size-5 shrink-0"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="truncate text-base font-medium">{document.title}</p>
                        <p className="text-muted-foreground text-sm">
                          {document.periodMonth
                            ? periodLabel(document.periodMonth)
                            : formatFrDateShort(document.createdAt.slice(0, 10))}{" "}
                          · {formatFileSize(document.sizeBytes)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {document.firstViewedAt === null ? (
                        <Badge variant="default">Nouveau</Badge>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => open(document.id)}
                      >
                        {pendingId === document.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Download className="size-4" aria-hidden />
                        )}
                        Ouvrir
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
