"use client";

import { KeyRound, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/core/ui/button";

import { resetPin } from "../../server/actions";
import { PinDialog } from "./pin-dialog";

interface PinResetButtonProps {
  employeeId: string;
  employeeName: string;
}

export function PinResetButton({ employeeId, employeeName }: PinResetButtonProps) {
  const [pin, setPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    startTransition(async () => {
      const result = await resetPin(employeeId);
      if (result.ok) setPin(result.data.pin);
      else setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={run} disabled={pending}>
        {pending ? (
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
        ) : (
          <KeyRound className="size-5" aria-hidden />
        )}
        Réinitialiser le code PIN
      </Button>
      {error ? (
        <p role="status" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <PinDialog pin={pin} employeeName={employeeName} onClose={() => setPin(null)} />
    </div>
  );
}
