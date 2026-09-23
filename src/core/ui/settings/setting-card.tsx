"use client";

import { Check, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { updateSetting } from "@/core/settings/actions";
import type { SettingDefinition } from "@/core/settings/registry";

import { Button } from "../button";
import { Input } from "../input";
import { Label } from "../label";
import { Select } from "../select";

interface SettingCardProps {
  definition: SettingDefinition;
  /** La valeur actuelle, déjà traduite en champs de formulaire. */
  fields: Record<string, string>;
}

/**
 * Un réglage, une carte, un bouton.
 *
 * Chaque réglage s'enregistre seul plutôt qu'à travers un grand formulaire
 * « Tout enregistrer ». C'est plus de clics et beaucoup moins d'accidents : on
 * change la tolérance de retard sans toucher, sans le vouloir, à la durée de
 * conservation des photos.
 *
 * Le composant ne connaît aucun réglage en particulier : il rend ce que le
 * registre décrit. Un réglage ajouté six mois plus tard s'affichera ici sans
 * qu'une ligne de ce fichier change.
 */
export function SettingCard({ definition, fields }: SettingCardProps) {
  const [draft, setDraft] = useState<Record<string, string>>(fields);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dirty = Object.keys(draft).some((key) => draft[key] !== fields[key]);

  function set(field: string, value: string): void {
    setSaved(false);
    setError(null);
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function submit(): void {
    setError(null);
    startTransition(async () => {
      const result = await updateSetting(definition.key, draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium">{definition.label}</h3>
        <p className="text-muted-foreground text-sm">{definition.help}</p>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <Fields definition={definition} draft={draft} onChange={set} />

        {definition.impact ? (
          <p className="text-muted-foreground text-sm italic">{definition.impact}</p>
        ) : null}

        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={submit} disabled={isPending || !dirty}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Enregistrer
          </Button>

          {saved && !dirty ? (
            <span className="flex items-center gap-1 text-sm text-emerald-700">
              <Check className="size-4" aria-hidden />
              Enregistré
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Fields({
  definition,
  draft,
  onChange,
}: {
  definition: SettingDefinition;
  draft: Record<string, string>;
  onChange: (field: string, value: string) => void;
}) {
  const field = definition.field;
  const id = `setting-${definition.key}`;

  if (field.kind === "text") {
    return (
      <Input
        id={id}
        aria-label={definition.label}
        value={draft.value ?? ""}
        onChange={(event) => onChange("value", event.target.value)}
      />
    );
  }

  if (field.kind === "number") {
    return (
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          className="w-32"
          min={field.min}
          max={field.max}
          step={field.step}
          aria-label={definition.label}
          value={draft.value ?? ""}
          onChange={(event) => onChange("value", event.target.value)}
        />
        {field.suffix ? <span className="text-muted-foreground">{field.suffix}</span> : null}
      </div>
    );
  }

  if (field.kind === "boolean") {
    return (
      <Select
        id={id}
        aria-label={definition.label}
        value={draft.value ?? "true"}
        onChange={(event) => onChange("value", event.target.value)}
        className="max-w-xs"
      >
        <option value="true">{field.trueLabel}</option>
        <option value="false">{field.falseLabel}</option>
      </Select>
    );
  }

  if (field.kind === "select") {
    const selected = field.options.find((option) => option.value === (draft.mode ?? ""));

    return (
      <div className="flex flex-col gap-2">
        <Select
          id={id}
          aria-label={definition.label}
          value={draft.mode ?? ""}
          onChange={(event) => onChange("mode", event.target.value)}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {selected?.help ? <p className="text-muted-foreground text-sm">{selected.help}</p> : null}
      </div>
    );
  }

  const times =
    field.kind === "schedule"
      ? ([
          ["start", "Début"],
          ["end", "Fin"],
          ["break_start", "Début de pause"],
          ["break_end", "Fin de pause"],
        ] as const)
      : ([
          ["start", "À partir de"],
          ["end", "Jusqu'à"],
        ] as const);

  return (
    <div className="grid grid-cols-2 gap-3 sm:max-w-md">
      {times.map(([name, label]) => (
        <div key={name} className="flex flex-col gap-2">
          <Label htmlFor={`${id}-${name}`}>{label}</Label>
          <Input
            id={`${id}-${name}`}
            type="time"
            value={draft[name] ?? ""}
            onChange={(event) => onChange(name, event.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
