"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatFrDate, todayInReunion, type DateString } from "@/core/time";
import { Button } from "@/core/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/ui/card";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Select } from "@/core/ui/select";

import { countLeaveDays, formatLeaveDays, type HalfDay } from "../../domain/count";
import { submitLeaveRequest } from "../../server/actions";

interface LeaveFormProps {
  balance: number;
  holidays: DateString[];
  nonWorkingDays: DateString[];
}

/**
 * Demander un congé.
 *
 * Le décompte affiché ici est un **aperçu**, calculé dans le navigateur à partir
 * des jours fériés et de ses jours de repos. Le chiffre qui fera foi est celui
 * que la base recalcule à l'envoi, puis une seconde fois à la validation. Les
 * deux suivent la même règle, et des tests le vérifient des deux côtés.
 */
export function LeaveForm({ balance, holidays, nonWorkingDays }: LeaveFormProps) {
  const today = todayInReunion();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [startHalf, setStartHalf] = useState<HalfDay | "">("");
  const [endHalf, setEndHalf] = useState<HalfDay | "">("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const preview = useMemo(() => {
    if (endDate < startDate) return null;
    try {
      return countLeaveDays({
        from: startDate,
        to: endDate,
        startHalf: startHalf || null,
        endHalf: endHalf || null,
        holidays,
        nonWorkingDays,
      });
    } catch {
      return null;
    }
  }, [startDate, endDate, startHalf, endHalf, holidays, nonWorkingDays]);

  function submit(): void {
    setError(null);
    startTransition(async () => {
      const result = await submitLeaveRequest({
        startDate,
        endDate,
        startHalf: startHalf || null,
        endHalf: endHalf || null,
        reason: reason.trim() ? reason.trim() : null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSent(true);
      setReason("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Demander un congé</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="leave-start">Du</Label>
            <Input
              id="leave-start"
              type="date"
              min={today}
              value={startDate}
              onChange={(event) => {
                const value = event.target.value;
                setStartDate(value);
                if (value > endDate) setEndDate(value);
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="leave-end">Au</Label>
            <Input
              id="leave-end"
              type="date"
              min={startDate}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="leave-start-half">Premier jour</Label>
            <Select
              id="leave-start-half"
              value={startHalf}
              onChange={(event) => setStartHalf(event.target.value as HalfDay | "")}
            >
              <option value="">Journée entière</option>
              <option value="pm">Je pars l&apos;après-midi</option>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="leave-end-half">Dernier jour</Label>
            <Select
              id="leave-end-half"
              value={endHalf}
              onChange={(event) => setEndHalf(event.target.value as HalfDay | "")}
            >
              <option value="">Journée entière</option>
              <option value="am">Je reviens l&apos;après-midi</option>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="leave-reason">Motif (facultatif)</Label>
          <Input
            id="leave-reason"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        {preview !== null ? (
          <div className="bg-secondary/50 rounded-xl p-4 text-base">
            <p>
              Du {formatFrDate(startDate)} au {formatFrDate(endDate)} :{" "}
              <strong>{formatLeaveDays(preview)}</strong> décomptés.
            </p>
            <p className="text-muted-foreground mt-1">
              Solde aujourd&apos;hui {formatLeaveDays(balance)} · après ce congé{" "}
              {formatLeaveDays(balance - preview)}
            </p>
            {preview === 0 ? (
              <p className="mt-1 text-amber-800">
                Ces dates ne contiennent aucun jour décompté : ce sont déjà des jours non
                travaillés.
              </p>
            ) : null}
            {balance - preview < 0 ? (
              <p className="mt-1 text-amber-800">
                Ce congé dépasse ton solde. Tu peux quand même demander : c&apos;est la direction
                qui tranche.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-destructive text-base">
            {error}
          </p>
        ) : null}

        {sent ? (
          <p className="text-base text-emerald-700">
            Demande envoyée. La direction est prévenue ; tu recevras une notification dès
            qu&apos;elle aura répondu.
          </p>
        ) : null}

        <Button
          size="lg"
          onClick={submit}
          disabled={isPending || preview === null || preview === 0}
        >
          Envoyer la demande
        </Button>
      </CardContent>
    </Card>
  );
}
