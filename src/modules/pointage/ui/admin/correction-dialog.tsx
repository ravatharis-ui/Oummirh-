"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatFrDate } from "@/core/time";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Modal } from "@/core/ui/modal";
import { Select } from "@/core/ui/select";

import { CLOCK_EVENTS, CLOCK_EVENT_LABELS, type ClockEventType } from "../../domain/sequence";
import { correctClock } from "../../server/actions";
import type { HistoryRow } from "../../types";

/**
 * Correcting a pointing.
 *
 * The wording is deliberate: this adds a corrected pointing, it does not edit the
 * original. The reason is mandatory because the audit trail is only worth
 * something if it says why.
 */
export function CorrectionDialog({ row, onClose }: { row: HistoryRow; onClose: () => void }) {
  const [eventType, setEventType] = useState<ClockEventType>("clock_in");
  const [time, setTime] = useState("09:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      const result = await correctClock({
        employeeId: row.employeeId,
        localDate: row.localDate,
        eventType,
        time,
        reason,
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
      title={`Corriger un pointage — ${row.displayName}`}
      description={formatFrDate(row.localDate)}
    >
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Le pointage d&apos;origine est conservé. Cette correction s&apos;ajoute, avec votre nom et
          votre motif.
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="correction-type">Pointage</Label>
          <Select
            id="correction-type"
            value={eventType}
            onChange={(event) => setEventType(event.target.value as ClockEventType)}
          >
            {CLOCK_EVENTS.map((type) => (
              <option key={type} value={type}>
                {CLOCK_EVENT_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="correction-time">Heure réelle</Label>
          <Input
            id="correction-time"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="correction-reason">Motif</Label>
          <Input
            id="correction-reason"
            value={reason}
            maxLength={500}
            placeholder="Téléphone déchargé, arrivée constatée à 9 h"
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={isPending}>
            Enregistrer la correction
          </Button>
        </div>
      </div>
    </Modal>
  );
}
