"use client";

import { Camera, CheckCircle2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { createBrowserSupabaseClient } from "@/core/db/client";
import { formatFrDate, toReunionTimeString } from "@/core/time";
import { Button } from "@/core/ui/button";
import { Card, CardContent } from "@/core/ui/card";

import { formatDelta } from "../../domain/delta";
import {
  alternateClockAction,
  CLOCK_EVENT_LABELS,
  clockAction,
  nextClockAction,
  type ClockAction,
  type ClockEventType,
} from "../../domain/sequence";
import { recordClock } from "../../server/actions";
import type { ClockRecord, ClockState } from "../../types";

type Phase = "idle" | "camera" | "sending" | "done";

/** The selfie is small on purpose: 720 px wide, JPEG at 0.7. */
const TARGET_WIDTH = 720;
const JPEG_QUALITY = 0.7;

export function ClockScreen({ state }: { state: ClockState }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [confirmation, setConfirmation] = useState<ClockRecord | null>(null);
  const [last, setLast] = useState<ClockEventType | null>(state.last);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingRef = useRef<ClockAction | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // The camera is released when the screen goes away, whatever the reason: a
  // lit camera light on a phone left in a pocket is not acceptable.
  useEffect(() => stopCamera, [stopCamera]);

  const next = nextClockAction(last);
  const alternate = alternateClockAction(last);

  async function send(action: ClockAction, photoPath: string | null): Promise<void> {
    setPhase("sending");
    setError(null);

    const result = await recordClock(action.type, photoPath);
    stopCamera();

    if (!result.ok) {
      setError(result.error);
      setPhase("idle");
      return;
    }

    setConfirmation(result.data.record);
    setLast(result.data.record.eventType);
    setPhase("done");

    // A short buzz: she is holding the phone, often without looking at it.
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(120);
    }
  }

  async function start(action: ClockAction): Promise<void> {
    setError(null);

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError(
        "Tu n'as pas de réseau. Le pointage ne peut pas être enregistré maintenant : préviens la direction plutôt que de pointer plus tard.",
      );
      return;
    }

    if (!action.needsPhoto || !state.selfieRequired || cameraDenied) {
      await send(action, null);
      return;
    }

    pendingRef.current = action;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Front camera, and only the camera: no gallery, no file picker, so the
        // photo can only be of the person standing there.
        video: { facingMode: "user", width: { ideal: TARGET_WIDTH } },
        audio: false,
      });

      streamRef.current = stream;
      setPhase("camera");

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
    } catch {
      setCameraDenied(true);
      setPhase("idle");
      setError(
        "L'accès à la caméra a été refusé. Ouvre les réglages de ton navigateur, autorise la caméra pour ce site, puis recharge la page.",
      );
    }
  }

  async function capture(): Promise<void> {
    const action = pendingRef.current;
    const video = videoRef.current;
    if (!action || !video) return;

    setPhase("sending");
    setError(null);

    try {
      const path = await uploadSelfie(video, state.employeeId);
      await send(action, path);
    } catch (cause) {
      console.error("[pointage] Envoi de la photo impossible", cause);
      stopCamera();
      setError("La photo n'est pas partie. Vérifie ta connexion et réessaie.");
      setPhase("idle");
    }
  }

  if (phase === "done" && confirmation) {
    return (
      <Confirmation
        record={confirmation}
        toleranceMinutes={state.toleranceMinutes}
        onContinue={() => {
          setConfirmation(null);
          setPhase("idle");
        }}
      />
    );
  }

  if (phase === "camera") {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-base">Regarde l&apos;objectif, puis valide.</p>
        <video
          ref={videoRef}
          playsInline
          muted
          className="bg-muted aspect-[3/4] w-full max-w-sm rounded-2xl object-cover"
        />
        <Button size="lg" className="w-full max-w-sm" onClick={capture}>
          <Camera aria-hidden />
          Prendre la photo et pointer
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            stopCamera();
            pendingRef.current = null;
            setPhase("idle");
          }}
        >
          Annuler
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PlannedDay state={state} />

      {next === null ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <CheckCircle2 className="size-10 text-emerald-600" aria-hidden />
            <p className="text-lg font-medium">Ta journée est terminée.</p>
            <p className="text-muted-foreground text-base">
              À demain. En cas d&apos;oubli, seule la direction peut corriger un pointage.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="h-28 w-full text-2xl"
            disabled={phase === "sending"}
            onClick={() => void start(next)}
          >
            {phase === "sending" ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {next.label}
          </Button>
          <p className="text-muted-foreground text-center text-base">{next.hint}</p>

          {alternate ? (
            <Button
              variant="outline"
              size="lg"
              disabled={phase === "sending"}
              onClick={() => void start(alternate)}
            >
              {alternate.label} (sans pause)
            </Button>
          ) : null}
        </div>
      )}

      {error ? (
        <p role="alert" className="text-destructive text-center text-base">
          {error}
        </p>
      ) : null}

      <TodayEvents state={state} />
    </div>
  );
}

function PlannedDay({ state }: { state: ClockState }) {
  return (
    <div className="text-center">
      <p className="text-muted-foreground text-base capitalize">{formatFrDate(state.localDate)}</p>
      {state.plannedStart && state.plannedEnd ? (
        <p className="text-base">
          Prévu : {state.plannedStart.slice(0, 5)} – {state.plannedEnd.slice(0, 5)}
        </p>
      ) : (
        <p className="text-muted-foreground text-base">Aucun horaire prévu aujourd&apos;hui.</p>
      )}
    </div>
  );
}

function TodayEvents({ state }: { state: ClockState }) {
  if (state.events.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <ul className="flex flex-col gap-2">
          {state.events.map((event) => (
            <li key={event.id} className="flex items-center justify-between gap-3 text-base">
              <span>{CLOCK_EVENT_LABELS[event.eventType]}</span>
              <span className="tabular-nums">
                {toReunionTimeString(new Date(event.occurredAt))}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Confirmation({
  record,
  toleranceMinutes,
  onContinue,
}: {
  record: ClockRecord;
  toleranceMinutes: number;
  onContinue: () => void;
}) {
  const action = clockAction(record.eventType);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <CheckCircle2 className="size-16 text-emerald-600" aria-hidden />
      <p className="text-xl font-medium">{CLOCK_EVENT_LABELS[record.eventType]} enregistrée</p>

      {/* The time comes from the server, not from this phone. */}
      <p className="text-5xl font-semibold tabular-nums">
        {toReunionTimeString(new Date(record.occurredAt))}
      </p>

      {record.plannedTime ? (
        <p className="text-muted-foreground text-base">
          {formatDelta(record.deltaMinutes, toleranceMinutes)}
        </p>
      ) : null}

      <p className="sr-only">{action.hint}</p>

      <Button size="lg" onClick={onContinue} className="mt-4 w-full max-w-sm">
        Continuer
      </Button>
    </div>
  );
}

/**
 * Captures the current frame and uploads it.
 *
 * Downscaled and compressed in the browser: what leaves the phone is around
 * 60 kB, which matters on a mobile connection and means far less of her face is
 * stored than the camera captured. Nothing is measured, compared or analysed —
 * the image is only ever looked at by a human, if it is ever looked at at all.
 */
async function uploadSelfie(video: HTMLVideoElement, employeeId: string): Promise<string> {
  const width = Math.min(TARGET_WIDTH, video.videoWidth || TARGET_WIDTH);
  const scale = width / (video.videoWidth || width);
  const height = Math.round((video.videoHeight || width) * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponible.");
  context.drawImage(video, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("Photo illisible.");

  const path = `${employeeId}/${crypto.randomUUID()}.jpg`;
  const supabase = createBrowserSupabaseClient();

  const { error } = await supabase.storage.from("selfies").upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (error) throw new Error(error.message);
  return path;
}
