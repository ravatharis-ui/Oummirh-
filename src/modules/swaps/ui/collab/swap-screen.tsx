"use client";

import { ArrowLeftRight, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { formatFrDate, formatFrDateShort } from "@/core/time";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/ui/card";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Select } from "@/core/ui/select";

import { canCancel, canPartnerAnswer, swapStatusMeta } from "../../domain/status";
import { answerSwap, cancelSwap, requestSwap } from "../../server/actions";
import type { MySwapsState, SwappableDay } from "../../types";

function dayLabel(day: SwappableDay): string {
  const when = formatFrDate(day.date);
  if (day.status === "rest") return `${when} — repos`;
  if (!day.startTime || !day.endTime) return when;
  return `${when} — ${day.startTime.slice(0, 5)}–${day.endTime.slice(0, 5)}`;
}

/**
 * La bourse d'échange, côté téléphone.
 *
 * Trois listes : ce que je propose, ce qu'on me demande, et le formulaire.
 * Les journées d'une collègue viennent d'une fonction qui ne montre que
 * l'échangeable : si elle est en congé ce jour-là, la journée n'apparaît pas —
 * et rien ne dit pourquoi.
 */
export function SwapScreen({ state }: { state: MySwapsState }) {
  return (
    <div className="flex flex-col gap-4">
      <Inbox state={state} />
      <SwapForm state={state} />
      <Sent state={state} />
    </div>
  );
}

function Inbox({ state }: { state: MySwapsState }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const waiting = state.received.filter((swap) => canPartnerAnswer(swap.status));

  function answer(id: string, accept: boolean): void {
    setError(null);
    startTransition(async () => {
      const result = await answerSwap(id, accept);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  if (waiting.length === 0) return null;

  return (
    <Card className="ring-primary ring-2">
      <CardHeader>
        <CardTitle className="text-base">On te demande un échange</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <p role="alert" className="text-destructive text-base">
            {error}
          </p>
        ) : null}

        {waiting.map((swap) => (
          <div key={swap.id} className="flex flex-col gap-3">
            <p className="text-base">
              <strong>{swap.requesterName}</strong> te propose de prendre sa journée du{" "}
              <strong>{formatFrDateShort(swap.requesterDate)}</strong>, et de lui laisser la tienne
              du <strong>{formatFrDateShort(swap.partnerDate)}</strong>.
            </p>

            {swap.message ? <p className="text-base italic">« {swap.message} »</p> : null}

            <p className="text-muted-foreground text-base">
              Si tu acceptes, la direction devra encore valider.
            </p>

            <div className="flex gap-2">
              <Button size="lg" disabled={isPending} onClick={() => answer(swap.id, true)}>
                <Check aria-hidden />
                J&apos;accepte
              </Button>
              <Button
                size="lg"
                variant="outline"
                disabled={isPending}
                onClick={() => answer(swap.id, false)}
              >
                <X aria-hidden />
                Je refuse
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SwapForm({ state }: { state: MySwapsState }) {
  const [partnerId, setPartnerId] = useState(state.colleagues[0]?.employeeId ?? "");
  const [requesterDate, setRequesterDate] = useState(state.myDays[0]?.date ?? "");
  const [partnerDate, setPartnerDate] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const partner = useMemo(
    () => state.colleagues.find((colleague) => colleague.employeeId === partnerId),
    [state.colleagues, partnerId],
  );

  function submit(): void {
    setError(null);
    startTransition(async () => {
      const result = await requestSwap({
        partnerId,
        requesterDate,
        partnerDate,
        message: message.trim() ? message.trim() : null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSent(true);
      setMessage("");
      setPartnerDate("");
      router.refresh();
    });
  }

  if (state.myDays.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proposer un échange</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-base">
            Tu n&apos;as aucune journée à venir à proposer pour l&apos;instant.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Proposer un échange</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="swap-mine">La journée que je propose</Label>
          <Select
            id="swap-mine"
            value={requesterDate}
            onChange={(event) => setRequesterDate(event.target.value)}
          >
            {state.myDays.map((day) => (
              <option key={day.date} value={day.date}>
                {dayLabel(day)}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="swap-partner">Avec qui</Label>
          <Select
            id="swap-partner"
            value={partnerId}
            onChange={(event) => {
              setPartnerId(event.target.value);
              setPartnerDate("");
            }}
          >
            {state.colleagues.map((colleague) => (
              <option key={colleague.employeeId} value={colleague.employeeId}>
                {colleague.displayName}
                {colleague.sameBoutique ? "" : ` (${colleague.boutiqueName})`}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="swap-theirs">La journée que je veux récupérer</Label>
          {partner && partner.days.length > 0 ? (
            <Select
              id="swap-theirs"
              value={partnerDate}
              onChange={(event) => setPartnerDate(event.target.value)}
            >
              <option value="">Choisir une journée</option>
              {partner.days.map((day) => (
                <option key={day.date} value={day.date}>
                  {dayLabel(day)}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-muted-foreground text-base">
              Aucune journée échangeable chez cette collègue sur les deux prochains mois.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="swap-message">Un mot pour elle (facultatif)</Label>
          <Input
            id="swap-message"
            value={message}
            maxLength={500}
            placeholder="Je dois emmener ma fille chez le médecin"
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>

        {error ? (
          <p role="alert" className="text-destructive text-base">
            {error}
          </p>
        ) : null}

        {sent ? (
          <p className="text-base text-emerald-700">
            Demande envoyée. Ta collègue répond d&apos;abord, la direction valide ensuite.
          </p>
        ) : null}

        <Button size="lg" disabled={isPending || !partnerDate || !requesterDate} onClick={submit}>
          <ArrowLeftRight aria-hidden />
          Envoyer la demande
        </Button>
      </CardContent>
    </Card>
  );
}

function Sent({ state }: { state: MySwapsState }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function cancel(id: string): void {
    setError(null);
    startTransition(async () => {
      const result = await cancelSwap(id);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mes demandes</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p role="alert" className="text-destructive mb-3 text-base">
            {error}
          </p>
        ) : null}

        {state.sent.length === 0 ? (
          <p className="text-muted-foreground text-base">
            Tu n&apos;as encore proposé aucun échange.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {state.sent.map((swap) => {
              const meta = swapStatusMeta(swap.status);

              return (
                <li key={swap.id} className="flex flex-col gap-1 border-b pb-3 last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-medium">
                      {formatFrDateShort(swap.requesterDate)} ↔{" "}
                      {formatFrDateShort(swap.partnerDate)}
                    </span>
                    <Badge variant={meta.badge}>{meta.requesterLabel}</Badge>
                  </div>

                  <span className="text-muted-foreground text-base">avec {swap.partnerName}</span>

                  {swap.adminComment ? (
                    <span className="text-base italic">« {swap.adminComment} »</span>
                  ) : null}

                  {canCancel(swap.status) ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      disabled={isPending}
                      onClick={() => cancel(swap.id)}
                    >
                      Annuler ma demande
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
