"use client";

import { Delete, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { Button } from "@/core/ui/button";
import { cn } from "@/core/ui/utils";

const PIN_LENGTH = 4;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

interface PinPadProps {
  employeeId: string;
  displayName: string;
}

/**
 * Keypad for the employee login.
 *
 * Deliberately not an `<input>`: the system keyboard would cover half a phone
 * screen, offer autocomplete on a secret, and put the code in the clipboard
 * history. Digits are held in component state and never leave it except in the
 * login request.
 */
export function PinPad({ employeeId, displayName }: PinPadProps) {
  const router = useRouter();
  const [digits, setDigits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = useCallback(
    async (pin: string) => {
      setPending(true);
      setError(null);
      try {
        const response = await fetch("/api/auth/pin", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ employeeId, pin }),
        });
        const payload: unknown = await response.json().catch(() => null);

        if (response.ok) {
          router.replace("/accueil");
          router.refresh();
          return;
        }

        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Connexion impossible. Réessayez.";
        setError(message);
        setDigits("");
        navigator.vibrate?.(200);
      } catch {
        setError("Pas de connexion. Vérifiez votre réseau et réessayez.");
        setDigits("");
      } finally {
        setPending(false);
      }
    },
    [employeeId, router],
  );

  // Submitting from the press handler rather than from an effect: the fourth digit
  // is a user action, not a state the component should react to afterwards.
  const press = (key: string) => {
    if (pending || digits.length >= PIN_LENGTH) return;
    const next = digits + key;
    setError(null);
    setDigits(next);
    if (next.length === PIN_LENGTH) void submit(next);
  };

  const erase = () => {
    if (pending) return;
    setError(null);
    setDigits((current) => current.slice(0, -1));
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <p className="text-2xl font-semibold">{displayName}</p>
        <p className="text-muted-foreground mt-1 text-base">Entrez votre code à 4 chiffres</p>
      </div>

      <div className="flex items-center gap-4" aria-hidden>
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <span
            key={index}
            className={cn(
              "size-4 rounded-full border-2 transition-colors",
              index < digits.length ? "border-primary bg-primary" : "border-muted-foreground/40",
            )}
          />
        ))}
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn(
          "min-h-12 max-w-xs text-center text-base",
          error ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <LoaderCircle className="size-5 animate-spin" aria-hidden /> Connexion…
          </span>
        ) : (
          error
        )}
      </p>

      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {KEYS.map((key) => (
          <Button
            key={key}
            type="button"
            variant="secondary"
            onClick={() => press(key)}
            disabled={pending}
            className="h-16 text-2xl font-medium"
          >
            {key}
          </Button>
        ))}
        <span />
        <Button
          type="button"
          variant="secondary"
          onClick={() => press("0")}
          disabled={pending}
          className="h-16 text-2xl font-medium"
        >
          0
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={erase}
          disabled={pending || digits.length === 0}
          aria-label="Effacer le dernier chiffre"
          className="h-16"
        >
          <Delete className="size-6" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
