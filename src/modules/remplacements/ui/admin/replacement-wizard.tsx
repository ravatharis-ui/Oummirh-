"use client";

import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatFrDate, todayInReunion, type DateString } from "@/core/time";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Modal } from "@/core/ui/modal";
import { Select } from "@/core/ui/select";
import { cn } from "@/core/ui/utils";

import { availabilityMeta } from "../../domain/availability";
import { createReplacement } from "../../server/actions";
import type { Candidate } from "../../types";

interface WizardProps {
  boutiques: { id: string; name: string }[];
  defaultStart: string;
  defaultEnd: string;
  /** Résolution des candidates : le parent recharge la liste quand date ou boutique changent. */
  candidates: Candidate[];
  onQueryChange: (date: DateString, boutiqueId: string) => void;
  isLoadingCandidates: boolean;
  onClose: () => void;
}

/**
 * Le formulaire en trois étapes.
 *
 * Étape 1 : où et quand. Étape 2 : qui, avec ce qu'on sait de chacune. Étape 3 :
 * relire avant d'envoyer — parce que l'étape suivante est une notification sur
 * le téléphone de quelqu'un, et qu'une notification ne se rattrape pas.
 */
export function ReplacementWizard({
  boutiques,
  defaultStart,
  defaultEnd,
  candidates,
  onQueryChange,
  isLoadingCandidates,
  onClose,
}: WizardProps) {
  const [step, setStep] = useState(1);
  const [boutiqueId, setBoutiqueId] = useState(boutiques[0]?.id ?? "");
  const [date, setDate] = useState(todayInReunion());
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);
  const [employeeId, setEmployeeId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const chosen = candidates.find((candidate) => candidate.employeeId === employeeId);
  const shop = boutiques.find((boutique) => boutique.id === boutiqueId);

  function goToCandidates(): void {
    setError(null);

    if (!boutiqueId) {
      setError("Choisissez le point de vente qui a besoin de renfort.");
      return;
    }

    if (endTime <= startTime) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }

    onQueryChange(date, boutiqueId);
    setStep(2);
  }

  function submit(): void {
    setError(null);
    startTransition(async () => {
      const result = await createReplacement({
        boutiqueId,
        date,
        employeeId,
        startTime,
        endTime,
        note: note.trim() ? note.trim() : null,
      });

      if (!result.ok) {
        setError(result.error);
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
      title="Remplacement direct"
      description={`Étape ${step} sur 3`}
      className="w-[min(40rem,calc(100vw-2rem))]"
    >
      <div className="flex flex-col gap-4">
        {step === 1 ? (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rpl-boutique">Point de vente qui a besoin de renfort</Label>
              <Select
                id="rpl-boutique"
                value={boutiqueId}
                onChange={(event) => setBoutiqueId(event.target.value)}
              >
                {boutiques.map((boutique) => (
                  <option key={boutique.id} value={boutique.id}>
                    {boutique.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rpl-date">Jour</Label>
                <Input
                  id="rpl-date"
                  type="date"
                  min={todayInReunion()}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rpl-start">De</Label>
                <Input
                  id="rpl-start"
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rpl-end">À</Label>
                <Input
                  id="rpl-end"
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </div>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {isLoadingCandidates ? (
              <p className="text-muted-foreground flex items-center gap-2 p-4">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Recherche des disponibilités…
              </p>
            ) : candidates.length === 0 ? (
              <p className="text-muted-foreground p-4 text-center">Aucune collaboratrice active.</p>
            ) : (
              candidates.map((candidate) => {
                const meta = availabilityMeta(candidate.availability);
                const selected = candidate.employeeId === employeeId;

                return (
                  <button
                    key={candidate.employeeId}
                    type="button"
                    disabled={!meta.selectable}
                    onClick={() => setEmployeeId(candidate.employeeId)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
                      selected && "border-primary ring-primary ring-1",
                      meta.selectable ? "hover:bg-accent" : "opacity-60",
                    )}
                  >
                    <span>
                      <span className="block font-medium">{candidate.displayName}</span>
                      <span className="text-muted-foreground block text-sm">
                        {candidate.homeBoutique}
                        {candidate.plannedShop && candidate.plannedStart
                          ? ` · ${candidate.plannedShop} ${candidate.plannedStart.slice(0, 5)}–${candidate.plannedEnd?.slice(0, 5) ?? ""}`
                          : ""}
                      </span>
                      <span className="text-muted-foreground block text-sm">{meta.hint}</span>
                    </span>
                    <Badge variant={meta.badge}>{meta.label}</Badge>
                  </button>
                );
              })
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-3">
            <div className="bg-secondary/50 rounded-xl p-4">
              <p className="text-base">
                <strong>{chosen?.displayName}</strong> est attendue à <strong>{shop?.name}</strong>
              </p>
              <p className="text-base capitalize">{formatFrDate(date)}</p>
              <p className="text-base">
                de {startTime} à {endTime}
              </p>
              {chosen?.availability === "working_elsewhere" ? (
                <p className="mt-2 text-sm text-amber-800">
                  Elle était prévue ailleurs ce jour-là : ce point de vente se retrouvera sans elle.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="rpl-note">Note (facultative)</Label>
              <Input
                id="rpl-note"
                value={note}
                maxLength={500}
                placeholder="Renfort soldes, remplacement d'un arrêt…"
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <p className="text-muted-foreground text-sm">
              Elle recevra une notification, et un email si elle a une adresse.
            </p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={isPending}>
              <ArrowLeft className="size-4" aria-hidden />
              Retour
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
          )}

          {step === 1 ? (
            <Button onClick={goToCandidates}>
              Choisir qui
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : null}

          {step === 2 ? (
            <Button disabled={!employeeId} onClick={() => setStep(3)}>
              Vérifier
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : null}

          {step === 3 ? (
            <Button onClick={submit} disabled={isPending}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              Confirmer le remplacement
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
