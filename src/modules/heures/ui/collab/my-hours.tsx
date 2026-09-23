"use client";

import { Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatDuration, formatFrDate, formatFrDateShort } from "@/core/time";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/ui/card";
import { Label } from "@/core/ui/label";
import { Modal } from "@/core/ui/modal";
import { Select } from "@/core/ui/select";
import { cn } from "@/core/ui/utils";

import {
  BALANCE_TONE_CLASS,
  balanceTone,
  checkRecoveryRequest,
  formatBalance,
  offeredDurations,
  RECOVERY_MODE_LABELS,
  RECOVERY_SHORTCUTS,
  RECOVERY_STATUS_LABELS,
  type RecoveryMode,
} from "../../domain/recovery";
import { requestRecovery } from "../../server/actions";
import { HoursDetailList } from "../hours-detail-list";
import type { MyHoursState } from "../../types";

const STATUS_VARIANT = {
  pending: "warning",
  approved: "success",
  refused: "danger",
  cancelled: "outline",
} as const;

/**
 * « Mon solde d'heures » et son bouton.
 *
 * Le solde est la somme de ses journées, pas un chiffre qu'on lui donne. Ce
 * n'est ni de la paie ni des heures supplémentaires légales : c'est du temps
 * qu'elle peut reprendre, et l'écran le dit.
 */
export function MyHours({ state }: { state: MyHoursState }) {
  const [open, setOpen] = useState(false);
  const tone = balanceTone(state.balanceMinutes);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mon solde d&apos;heures</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className={cn("text-4xl font-semibold tabular-nums", BALANCE_TONE_CLASS[tone])}>
            {formatBalance(state.balanceMinutes)}
          </p>

          {state.pendingMinutes > 0 ? (
            <p className="text-muted-foreground text-base">
              Dont {formatDuration(state.pendingMinutes)} déjà demandés et pas encore tranchés.
              Disponible : <strong>{formatDuration(state.availableMinutes)}</strong>.
            </p>
          ) : null}

          <Button
            size="lg"
            disabled={state.availableMinutes < 15 || state.eligibleDays.length === 0}
            onClick={() => setOpen(true)}
          >
            <Zap aria-hidden />
            Prendre mes heures supp
          </Button>

          {state.availableMinutes < 15 ? (
            <p className="text-muted-foreground text-base">
              Il faut au moins quinze minutes de solde disponible pour faire une demande.
            </p>
          ) : state.eligibleDays.length === 0 ? (
            <p className="text-muted-foreground text-base">
              Aucune journée de travail à venir sur laquelle poser une récupération.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mes demandes</CardTitle>
        </CardHeader>
        <CardContent>
          {state.requests.length === 0 ? (
            <p className="text-muted-foreground text-base">Aucune demande pour le moment.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {state.requests.map((request) => (
                <li key={request.id} className="flex flex-col gap-1 border-b pb-3 last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-medium">
                      {formatFrDateShort(request.date)} · {RECOVERY_MODE_LABELS[request.mode]}
                    </span>
                    <Badge variant={STATUS_VARIANT[request.status]}>
                      {RECOVERY_STATUS_LABELS[request.status]}
                    </Badge>
                  </div>
                  <span className="text-muted-foreground text-base">
                    {formatDuration(request.minutes)}
                  </span>
                  {request.adminComment ? (
                    <span className="text-base italic">« {request.adminComment} »</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Le détail de mon compteur</CardTitle>
        </CardHeader>
        <CardContent>
          <HoursDetailList rows={state.detail} />
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-sm">
        Ce solde est un compteur interne de récupération. Il ne calcule ni majoration ni paie.
      </p>

      {open ? <RecoveryDialog state={state} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function RecoveryDialog({ state, onClose }: { state: MyHoursState; onClose: () => void }) {
  const firstDay = state.eligibleDays[0];
  const [date, setDate] = useState(firstDay?.date ?? "");
  const [mode, setMode] = useState<RecoveryMode>("later");
  const [minutes, setMinutes] = useState(
    Math.min(60, Math.floor(state.availableMinutes / 15) * 15),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const durations = offeredDurations(state.availableMinutes);
  const check = checkRecoveryRequest(minutes, state.availableMinutes);

  function submit(): void {
    setError(null);

    if (!check.ok) {
      setError(check.error);
      return;
    }

    startTransition(async () => {
      const result = await requestRecovery({ date, mode, minutes });
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
      title="Prendre mes heures supp"
      description={`Disponible : ${formatDuration(state.availableMinutes)}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="recovery-mode">Ce que je veux faire</Label>
          <Select
            id="recovery-mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as RecoveryMode)}
          >
            <option value="later">Arriver plus tard</option>
            <option value="earlier">Partir plus tôt</option>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="recovery-date">Quel jour</Label>
          <Select id="recovery-date" value={date} onChange={(event) => setDate(event.target.value)}>
            {state.eligibleDays.map((day) => (
              <option key={day.date} value={day.date}>
                {formatFrDate(day.date)} ({day.startTime} – {day.endTime})
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="recovery-minutes">Combien de temps</Label>
          <div className="flex flex-wrap gap-2">
            {RECOVERY_SHORTCUTS.filter((shortcut) => shortcut <= state.availableMinutes).map(
              (shortcut) => (
                <Button
                  key={shortcut}
                  type="button"
                  variant={minutes === shortcut ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setMinutes(shortcut)}
                >
                  {formatDuration(shortcut)}
                </Button>
              ),
            )}
          </div>
          <Select
            id="recovery-minutes"
            value={String(minutes)}
            onChange={(event) => setMinutes(Number(event.target.value))}
          >
            {durations.map((duration) => (
              <option key={duration} value={duration}>
                {formatDuration(duration)}
              </option>
            ))}
          </Select>
        </div>

        {error ? (
          <p role="alert" className="text-destructive text-base">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={isPending || !date || !check.ok}>
            Envoyer la demande
          </Button>
        </div>
      </div>
    </Modal>
  );
}
