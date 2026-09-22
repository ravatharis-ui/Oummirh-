"use client";

import { ArchiveRestore, ArchiveX, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/core/ui/button";

import { setEmployeeActive } from "../../server/actions";

interface ArchiveToggleProps {
  employeeId: string;
  isActive: boolean;
}

/** Archives or restores. Nothing is ever deleted: the history has to survive. */
export function ArchiveToggle({ employeeId, isActive }: ArchiveToggleProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    startTransition(async () => {
      const result = await setEmployeeActive(employeeId, !isActive);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Button variant={isActive ? "outline" : "default"} onClick={run} disabled={pending}>
        {pending ? (
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
        ) : isActive ? (
          <ArchiveX className="size-5" aria-hidden />
        ) : (
          <ArchiveRestore className="size-5" aria-hidden />
        )}
        {isActive ? "Archiver" : "Réintégrer"}
      </Button>
      {error ? (
        <p role="status" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
