"use client";

import { Camera } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";

import { Button } from "@/core/ui/button";
import { Modal } from "@/core/ui/modal";

import { openSelfie } from "../../server/actions";

/**
 * The selfie of one pointing, seen by the direction.
 *
 * The link is signed for sixty seconds and asked for at the click: there is no
 * address in the page to copy, and nothing that still opens tomorrow. Once the
 * retention period has passed the file is gone and the button says so rather
 * than showing a broken frame.
 */
export function SelfieViewer({ photoPath, label }: { photoPath: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function show(): void {
    setError(null);
    startTransition(async () => {
      const result = await openSelfie(photoPath);
      if (result.ok) setUrl(result.data.url);
      else setError(result.error);
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto px-1 py-0"
        disabled={isPending}
        onClick={show}
      >
        <Camera className="size-4" aria-hidden />
        <span className="sr-only">Voir la photo — {label}</span>
      </Button>

      {error ? <span className="text-destructive block text-xs">{error}</span> : null}

      {url ? (
        <Modal open title={label} onClose={() => setUrl(null)}>
          {/* Unoptimized: the URL expires in sixty seconds, so there is nothing
              worth putting in a cache. */}
          <Image
            src={url}
            alt={`Photo du pointage — ${label}`}
            width={360}
            height={480}
            unoptimized
            className="w-full rounded-xl"
          />
        </Modal>
      ) : null}
    </>
  );
}
