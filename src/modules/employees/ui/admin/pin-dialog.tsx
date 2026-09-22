"use client";

import { Check, Copy, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/core/ui/button";
import { Modal } from "@/core/ui/modal";

interface PinDialogProps {
  pin: string | null;
  employeeName: string;
  onClose: () => void;
}

/**
 * Shows a freshly drawn PIN, once.
 *
 * Nothing stores it: the database only ever received its bcrypt hash. If it is
 * lost, the answer is another reset, never a lookup — which is exactly what makes
 * the codes worth something.
 */
export function PinDialog({ pin, employeeName, onClose }: PinDialogProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!pin) return;
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused: the code is on screen anyway.
    }
  };

  return (
    <Modal
      open={pin !== null}
      onClose={onClose}
      title={`Code PIN de ${employeeName}`}
      description="Notez-le maintenant : il ne sera plus jamais affiché."
    >
      <div className="flex flex-col gap-4">
        <p
          className="bg-secondary rounded-xl py-6 text-center font-mono text-5xl font-semibold tracking-[0.3em]"
          aria-label={`Code ${pin?.split("").join(" ")}`}
        >
          {pin}
        </p>

        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Transmettez-le de vive voix. Si ce code est perdu, il faudra en générer un nouveau.
          </span>
        </p>

        <div className="flex gap-2">
          <Button variant="outline" onClick={copy} className="flex-1">
            {copied ? (
              <>
                <Check className="size-5" aria-hidden /> Copié
              </>
            ) : (
              <>
                <Copy className="size-5" aria-hidden /> Copier
              </>
            )}
          </Button>
          <Button onClick={onClose} className="flex-1">
            J&apos;ai noté le code
          </Button>
        </div>
      </div>
    </Modal>
  );
}
