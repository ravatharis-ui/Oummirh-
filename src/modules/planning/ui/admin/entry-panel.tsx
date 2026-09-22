"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Modal } from "@/core/ui/modal";
import { Select } from "@/core/ui/select";
import { formatFrDate, type DateString } from "@/core/time";

import {
  isProtectedSource,
  PLANNING_STATUSES,
  PLANNING_STATUS_META,
  QUICK_PRESETS,
  type PlanningStatus,
} from "../../domain/status";
import { clearPlanningEntry, savePlanningEntry } from "../../server/actions";
import type { PlanningEntry } from "../../types";

interface EntryPanelProps {
  employeeId: string;
  employeeName: string;
  date: DateString;
  entry: PlanningEntry | null;
  onClose: (changed: boolean) => void;
}

interface DraftState {
  status: PlanningStatus;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  note: string;
}

function toDraft(entry: PlanningEntry | null): DraftState {
  return {
    status: (entry?.status as PlanningStatus) ?? "work",
    startTime: entry?.startTime?.slice(0, 5) ?? "09:00",
    endTime: entry?.endTime?.slice(0, 5) ?? "17:30",
    breakStart: entry?.breakStart?.slice(0, 5) ?? "",
    breakEnd: entry?.breakEnd?.slice(0, 5) ?? "",
    note: entry?.note ?? "",
  };
}

/**
 * Editing one day.
 *
 * The quick buttons write the whole draft at once, because that is how the week
 * is actually filled: five identical days and two exceptions. Typing four times
 * per cell would take longer than the planning is worth.
 */
export function EntryPanel({ employeeId, employeeName, date, entry, onClose }: EntryPanelProps) {
  const [draft, setDraft] = useState<DraftState>(() => toDraft(entry));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const needsHours = PLANNING_STATUS_META[draft.status].needsHours;
  const locked = entry ? isProtectedSource(entry.source) : false;

  function submit(): void {
    setError(null);
    startTransition(async () => {
      const result = await savePlanningEntry({
        employeeId,
        date,
        status: draft.status,
        startTime: needsHours ? draft.startTime : null,
        endTime: needsHours ? draft.endTime : null,
        breakStart: needsHours && draft.breakStart ? draft.breakStart : null,
        breakEnd: needsHours && draft.breakEnd ? draft.breakEnd : null,
        note: draft.note.trim() ? draft.note.trim() : null,
      });

      if (!result.ok) setError(result.error);
      else onClose(true);
    });
  }

  function remove(): void {
    setError(null);
    startTransition(async () => {
      const result = await clearPlanningEntry(employeeId, date);
      if (!result.ok) setError(result.error);
      else onClose(true);
    });
  }

  return (
    <Modal
      open
      onClose={() => onClose(false)}
      title={employeeName}
      description={formatFrDate(date)}
    >
      <div className="flex flex-col gap-4">
        {locked ? (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Cette journée a été posée par un congé, un remplacement ou un échange. La modifier ici
            la détachera de la demande d&apos;origine.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {QUICK_PRESETS.map((preset) => (
            <Button
              key={preset.key}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  status: preset.status,
                  startTime: preset.start ?? current.startTime,
                  endTime: preset.end ?? current.endTime,
                  breakStart: preset.breakStart ?? "",
                  breakEnd: preset.breakEnd ?? "",
                }))
              }
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="planning-status">Journée</Label>
          <Select
            id="planning-status"
            value={draft.status}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                status: event.target.value as PlanningStatus,
              }))
            }
          >
            {PLANNING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PLANNING_STATUS_META[status].label}
              </option>
            ))}
          </Select>
        </div>

        {needsHours ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="planning-start">Début</Label>
              <Input
                id="planning-start"
                type="time"
                value={draft.startTime}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, startTime: event.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="planning-end">Fin</Label>
              <Input
                id="planning-end"
                type="time"
                value={draft.endTime}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, endTime: event.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="planning-break-start">Début de pause</Label>
              <Input
                id="planning-break-start"
                type="time"
                value={draft.breakStart}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, breakStart: event.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="planning-break-end">Fin de pause</Label>
              <Input
                id="planning-break-end"
                type="time"
                value={draft.breakEnd}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, breakEnd: event.target.value }))
                }
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="planning-note">Note (facultative)</Label>
          <Input
            id="planning-note"
            value={draft.note}
            maxLength={500}
            onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
          />
        </div>

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          {entry ? (
            <Button type="button" variant="ghost" onClick={remove} disabled={isPending}>
              <Trash2 className="size-4" aria-hidden />
              Vider
            </Button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button type="button" onClick={submit} disabled={isPending}>
              Enregistrer
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
