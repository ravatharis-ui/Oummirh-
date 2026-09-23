"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setModuleEnabled } from "@/core/settings/actions";

import { Badge } from "../badge";
import { Button } from "../button";

export interface ModuleRow {
  key: string;
  name: string;
  enabled: boolean;
  /** Ce que le module fait, en une phrase, pour quelqu'un qui n'a pas écrit le code. */
  description: string;
  /** Un module dont l'application ne peut pas se passer ne s'éteint pas. */
  required: boolean;
}

/**
 * Activer ou désactiver un module.
 *
 * Un module éteint disparaît des menus et cesse de traiter ses événements.
 * **Ses données restent en place** et reviennent intactes s'il est rallumé :
 * c'est ce qui permet d'essayer une fonctionnalité sans s'engager, et de
 * l'éteindre un mois chargé sans rien perdre.
 */
export function ModuleManager({ modules }: { modules: ModuleRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(row: ModuleRow): void {
    setError(null);
    startTransition(async () => {
      const result = await setModuleEnabled(row.key, !row.enabled);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Un module éteint disparaît des menus. Ses données sont conservées et réapparaissent telles
        quelles si vous le rallumez.
      </p>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {modules.map((row) => (
          <li
            key={row.key}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
          >
            <div>
              <p className="flex items-center gap-2 font-medium">
                {row.name}
                {row.enabled ? null : <Badge variant="outline">Éteint</Badge>}
              </p>
              <p className="text-muted-foreground text-sm">{row.description}</p>
            </div>

            {row.required ? (
              <span className="text-muted-foreground text-sm">Indispensable</span>
            ) : (
              <Button variant="ghost" size="sm" disabled={isPending} onClick={() => toggle(row)}>
                {row.enabled ? "Éteindre" : "Allumer"}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
