"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "./button";
import { cn } from "./utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Built on the native `<dialog>`, which traps focus, closes on Escape and stays
 * on the top layer without any of that being reimplemented.
 */
export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="modal-title"
      className={cn(
        "bg-card text-card-foreground m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border p-0 shadow-lg",
        "backdrop:bg-foreground/40 backdrop:backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 p-6 pb-2">
        <div>
          <h2 id="modal-title" className="text-lg font-semibold">
            {title}
          </h2>
          {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
          <X className="size-5" aria-hidden />
        </Button>
      </div>
      <div className="p-6 pt-2">{children}</div>
    </dialog>
  );
}
