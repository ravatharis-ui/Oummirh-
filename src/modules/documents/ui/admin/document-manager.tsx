"use client";

import { AlertTriangle, Check, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createBrowserSupabaseClient } from "@/core/db/client";
import { formatFrDateShort } from "@/core/time";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Modal } from "@/core/ui/modal";
import { Select } from "@/core/ui/select";

import { categoryMeta, periodLabel } from "../../domain/categories";
import { checkDocumentFile, formatFileSize } from "../../domain/file";
import {
  duplicateAssignments,
  matchFiles,
  unmatchedCount,
  type FileMatch,
  type MatchableEmployee,
} from "../../domain/matching";
import { prepareDocumentPath, recordDocument, removeDocument } from "../../server/actions";
import type { EmployeeDocuments } from "../../types";

interface ManagerProps {
  coffres: EmployeeDocuments[];
  employees: MatchableEmployee[];
  /** Le mois par défaut d'un dépôt en lot : le mois écoulé. */
  defaultMonth: string;
}

/**
 * Le dépôt, côté direction.
 *
 * Le fichier va du navigateur directement au stockage : un PDF de dix Mo n'a
 * rien à faire dans la mémoire du serveur d'application, et la politique du
 * bucket réserve déjà l'écriture à la direction.
 */
export function DocumentManager({ coffres, employees, defaultMonth }: ManagerProps) {
  const [batchOpen, setBatchOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function remove(id: string): void {
    setError(null);
    startTransition(async () => {
      const result = await removeDocument(id);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Coffres de l&apos;équipe</h2>
        <Button size="sm" onClick={() => setBatchOpen(true)}>
          <Upload className="size-4" aria-hidden />
          Déposer les fiches de paie du mois
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {coffres.map((coffre) => (
          <li key={coffre.employeeId} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {coffre.displayName}
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  {coffre.documents.length} document{coffre.documents.length > 1 ? "s" : ""}
                </span>
              </p>
              {coffre.neverOpened > 0 ? (
                <Badge variant="warning">
                  {coffre.neverOpened} jamais ouvert{coffre.neverOpened > 1 ? "s" : ""}
                </Badge>
              ) : coffre.documents.length > 0 ? (
                <Badge variant="success">Tout consulté</Badge>
              ) : null}
            </div>

            {coffre.documents.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2">
                {coffre.documents.map((document) => (
                  <li key={document.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
                      <span className="truncate">
                        {document.title}
                        <span className="text-muted-foreground">
                          {" · "}
                          {categoryMeta(document.category).label}
                          {document.periodMonth ? ` · ${periodLabel(document.periodMonth)}` : ""}
                          {" · "}
                          {formatFileSize(document.sizeBytes)}
                        </span>
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-2">
                      {document.firstViewedAt ? (
                        <span className="text-muted-foreground text-xs">
                          ouvert le {formatFrDateShort(document.firstViewedAt.slice(0, 10))}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700">jamais ouvert</span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => remove(document.id)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        <span className="sr-only">Retirer {document.title}</span>
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>

      {batchOpen ? (
        <BatchDialog
          employees={employees}
          defaultMonth={defaultMonth}
          onClose={() => setBatchOpen(false)}
        />
      ) : null}
    </div>
  );
}

interface Pending {
  file: File;
  match: FileMatch;
}

/**
 * Le dépôt en lot.
 *
 * La reconnaissance automatique par nom de fichier est délibérément timide : au
 * moindre doute elle ne propose rien. Attribuer la fiche de paie de quelqu'un à
 * une autre personne est l'erreur la plus grave que ce module puisse commettre,
 * et c'est pour ça que l'envoi reste bloqué tant qu'un fichier n'est pas associé.
 */
function BatchDialog({
  employees,
  defaultMonth,
  onClose,
}: {
  employees: MatchableEmployee[];
  defaultMonth: string;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(defaultMonth);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const matches = pending.map((item) => item.match);
  const remaining = unmatchedCount(matches);
  const duplicates = duplicateAssignments(matches);

  function accept(files: FileList | null): void {
    setError(null);
    if (!files) return;

    const accepted: File[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(files)) {
      const check = checkDocumentFile(file);
      if (check.ok) accepted.push(file);
      else rejected.push(`${file.name} — ${check.error}`);
    }

    if (rejected.length > 0) setError(rejected.join(" · "));

    const computed = matchFiles(
      accepted.map((file) => file.name),
      employees,
    );

    setPending(
      accepted.map((file, index) => ({
        file,
        match: computed[index] ?? { fileName: file.name, employeeId: null, reason: "no-match" },
      })),
    );
  }

  function assign(fileName: string, employeeId: string): void {
    setPending((current) =>
      current.map((item) =>
        item.match.fileName === fileName
          ? {
              ...item,
              match: {
                ...item.match,
                employeeId: employeeId || null,
                reason: employeeId ? "matched" : "no-match",
              },
            }
          : item,
      ),
    );
  }

  function submit(): void {
    setError(null);

    startTransition(async () => {
      const supabase = createBrowserSupabaseClient();
      const failures: string[] = [];
      let done = 0;

      for (const item of pending) {
        const employeeId = item.match.employeeId;
        if (!employeeId) continue;

        setProgress(`${done + 1} / ${pending.length} — ${item.file.name}`);

        const prepared = await prepareDocumentPath(employeeId);
        if (!prepared.ok) {
          failures.push(`${item.file.name} — ${prepared.error}`);
          continue;
        }

        const upload = await supabase.storage
          .from("documents")
          .upload(prepared.data.path, item.file, {
            contentType: "application/pdf",
            upsert: false,
          });

        if (upload.error) {
          failures.push(`${item.file.name} — envoi impossible`);
          continue;
        }

        const recorded = await recordDocument({
          employeeId,
          category: "payslip",
          title: `Fiche de paie ${periodLabel(month)}`,
          periodMonth: month,
          storagePath: prepared.data.path,
          sizeBytes: item.file.size,
        });

        if (!recorded.ok) {
          // Le fichier est parti mais la ligne n'a pas suivi : on retire le
          // fichier, sinon le stockage garderait un orphelin inatteignable.
          await supabase.storage.from("documents").remove([prepared.data.path]);
          failures.push(`${item.file.name} — ${recorded.error}`);
          continue;
        }

        done += 1;
      }

      setProgress(null);

      if (failures.length > 0) {
        setError(failures.join(" · "));
        router.refresh();
        return;
      }

      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Déposer les fiches de paie du mois"
      description="Glissez tous les PDF d'un coup : les noms de fichiers font le reste."
      className="w-[min(44rem,calc(100vw-2rem))]"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="batch-month">Mois</Label>
            <Input
              id="batch-month"
              type="month"
              className="w-44"
              value={month.slice(0, 7)}
              onChange={(event) => setMonth(`${event.target.value}-01`)}
            />
          </div>

          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="batch-files">Fichiers PDF</Label>
            <Input
              id="batch-files"
              type="file"
              accept="application/pdf"
              multiple
              className="h-auto py-2"
              onChange={(event) => accept(event.target.files)}
            />
          </div>
        </div>

        {pending.length > 0 ? (
          <div className="max-h-[40vh] overflow-y-auto">
            <ul className="flex flex-col gap-2">
              {pending.map((item) => (
                <li
                  key={item.match.fileName}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2"
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    <span className="truncate">{item.match.fileName}</span>
                    <span className="text-muted-foreground shrink-0">
                      {formatFileSize(item.file.size)}
                    </span>
                  </span>

                  <span className="flex items-center gap-2">
                    {item.match.reason === "ambiguous" ? (
                      <AlertTriangle className="size-4 text-amber-700" aria-hidden />
                    ) : item.match.employeeId ? (
                      <Check className="size-4 text-emerald-700" aria-hidden />
                    ) : null}

                    <Select
                      aria-label={`Collaboratrice pour ${item.match.fileName}`}
                      className="h-10 w-56"
                      value={item.match.employeeId ?? ""}
                      onChange={(event) => assign(item.match.fileName, event.target.value)}
                    >
                      <option value="">À associer…</option>
                      {employees.map((employee) => (
                        <option key={employee.employeeId} value={employee.employeeId}>
                          {employee.displayName} ({employee.lastName})
                        </option>
                      ))}
                    </Select>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {remaining > 0 ? (
          <p className="text-sm text-amber-800">
            {remaining} fichier{remaining > 1 ? "s" : ""} encore à associer. Le nom de famille
            n&apos;a pas suffi — à vous de trancher.
          </p>
        ) : null}

        {duplicates.length > 0 ? (
          <p className="text-sm text-amber-800">
            Plusieurs fichiers sont attribués à la même personne. Vérifiez avant d&apos;envoyer.
          </p>
        ) : null}

        {progress ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Envoi en cours — {progress}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={isPending || pending.length === 0 || remaining > 0}>
            Envoyer {pending.length > 0 ? `(${pending.length})` : ""}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
