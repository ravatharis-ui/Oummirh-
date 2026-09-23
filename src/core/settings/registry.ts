import type { z } from "zod";

import { DEFAULT_SETTINGS, settingsSchema, type AppSettings, type SettingsKey } from "./schemas";

/**
 * Le registre des réglages.
 *
 * C'est **la** pièce qui rend l'écran de paramétrage durable. Chaque réglage y
 * est décrit une fois — son libellé, son aide, son groupe, la forme de son
 * champ — et l'écran se construit à partir de cette liste. Ajouter un réglage
 * six mois plus tard, c'est ajouter une entrée ici et une migration qui pose sa
 * valeur par défaut. Aucun composant à écrire, aucune page à retoucher.
 *
 * L'ordre du tableau est l'ordre d'affichage.
 */

export type SettingGroupKey = "etablissement" | "conges" | "pointage" | "heures";

export interface SettingGroup {
  key: SettingGroupKey;
  label: string;
  help: string;
}

export const SETTING_GROUPS: readonly SettingGroup[] = [
  {
    key: "etablissement",
    label: "Établissement",
    help: "Le nom qui apparaît dans l'application et dans les emails.",
  },
  {
    key: "conges",
    label: "Congés",
    help: "Comment les jours s'acquièrent, se décomptent et se reportent.",
  },
  {
    key: "pointage",
    label: "Pointage",
    help: "Ce qui compte comme un retard, et ce qu'on garde des selfies.",
  },
  {
    key: "heures",
    label: "Heures",
    help: "Le pas des récupérations d'heures.",
  },
];

/** Les formes de champ que l'écran sait rendre. */
export type SettingField =
  | { kind: "text" }
  | { kind: "number"; min?: number; max?: number; step?: number; suffix?: string }
  | { kind: "select"; options: { value: string; label: string; help?: string }[] }
  | { kind: "boolean"; trueLabel: string; falseLabel: string }
  | { kind: "schedule" }
  | { kind: "window" };

export interface SettingDefinition<K extends SettingsKey = SettingsKey> {
  key: K;
  group: SettingGroupKey;
  label: string;
  /** Une phrase qui dit ce que le réglage change **concrètement**, pas ce qu'il est. */
  help: string;
  field: SettingField;
  /**
   * Ce qui se passe pour l'existant quand on change la valeur. Affiché sous le
   * champ, parce qu'un gérant a le droit de savoir avant de cliquer.
   */
  impact?: string;
}

/**
 * Comment un réglage se lit et s'écrit.
 *
 * Certains réglages sont des objets (`default_schedule`), d'autres des nombres
 * ou des booléens. Le formulaire, lui, ne manipule que des chaînes : ces deux
 * fonctions font la traduction dans les deux sens, une fois pour toutes.
 */
export interface SettingCodec<T> {
  toForm: (value: T) => Record<string, string>;
  fromForm: (fields: Record<string, string>) => unknown;
}

export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  {
    key: "company_name",
    group: "etablissement",
    label: "Nom de l'entreprise",
    help: "Apparaît en tête des emails et sur les plannings imprimés.",
    field: { kind: "text" },
  },
  {
    key: "default_schedule",
    group: "etablissement",
    label: "Horaires par défaut",
    help: "Les horaires proposés quand on crée une collaboratrice ou une journée de planning.",
    field: { kind: "schedule" },
    impact: "Ne change aucun planning déjà saisi ni aucune fiche existante.",
  },
  {
    key: "leave_rules",
    group: "conges",
    label: "Règle d'acquisition",
    help: "Détermine combien de jours s'acquièrent chaque mois et quels jours sont décomptés.",
    field: {
      kind: "select",
      options: [
        {
          value: "ouvrables",
          label: "Jours ouvrables — 2,5 j/mois, 30 j/an",
          help: "Du lundi au samedi, hors jours fériés. C'est l'usage le plus courant dans le commerce.",
        },
        {
          value: "ouvres",
          label: "Jours ouvrés — 2,08 j/mois, 25 j/an",
          help: "Du lundi au vendredi, hors jours fériés. Le samedi ne décompte pas.",
        },
      ],
    },
    impact:
      "S'applique aux acquisitions et aux congés à venir. Les congés déjà validés gardent le décompte arrêté le jour de la décision.",
  },
  {
    key: "late_tolerance_minutes",
    group: "pointage",
    label: "Tolérance de retard",
    help: "En dessous de cette durée, une arrivée est considérée « à l'heure » et n'alerte personne.",
    field: { kind: "number", min: 0, max: 120, step: 5, suffix: "minutes" },
  },
  {
    key: "clock_check_window",
    group: "pointage",
    label: "Fenêtre des alertes",
    help: "Les alertes de retard et de départ non pointé ne partent qu'entre ces deux heures.",
    field: { kind: "window" },
    impact: "Personne ne reçoit d'alerte en dehors de cette plage, même si un pointage manque.",
  },
  {
    key: "missing_clock_out_delay_minutes",
    group: "pointage",
    label: "Délai avant alerte de départ",
    help: "Temps après l'heure de fin prévue au bout duquel la direction est prévenue qu'un départ n'a pas été pointé.",
    field: { kind: "number", min: 15, max: 480, step: 15, suffix: "minutes" },
  },
  {
    key: "selfie_required",
    group: "pointage",
    label: "Selfie à l'arrivée",
    help: "Demander une photo au moment de pointer l'arrivée.",
    field: { kind: "boolean", trueLabel: "Demandé", falseLabel: "Pas demandé" },
    impact: "Les selfies déjà pris restent soumis à la durée de conservation ci-dessous.",
  },
  {
    key: "selfie_retention_days",
    group: "pointage",
    label: "Conservation des selfies",
    help: "Au-delà de cette durée, les photos sont supprimées chaque nuit. Les pointages, eux, sont conservés.",
    field: { kind: "number", min: 7, max: 365, step: 1, suffix: "jours" },
    impact:
      "Raccourcir cette durée supprimera des photos dès la nuit prochaine, sans retour possible.",
  },
  {
    key: "overtime_recovery_min_step_minutes",
    group: "heures",
    label: "Pas des récupérations",
    help: "Les récupérations d'heures se demandent par tranches de cette durée.",
    field: { kind: "number", min: 5, max: 60, step: 5, suffix: "minutes" },
  },
];

/** Les définitions d'un groupe, dans l'ordre du registre. */
export function definitionsOfGroup(group: SettingGroupKey): SettingDefinition[] {
  return SETTING_DEFINITIONS.filter((definition) => definition.group === group);
}

export function findDefinition(key: string): SettingDefinition | undefined {
  return SETTING_DEFINITIONS.find((definition) => definition.key === key);
}

const TIME = /^\d{2}:\d{2}$/;

/**
 * Traduit la valeur d'un réglage vers les champs du formulaire.
 *
 * Un `Record<string, string>` et non une valeur typée : le DOM ne rend que des
 * chaînes, et faire semblant du contraire complique les deux bouts.
 */
export function toFormFields(key: SettingsKey, settings: AppSettings): Record<string, string> {
  const value = settings[key];

  if (key === "default_schedule") {
    const schedule = value as AppSettings["default_schedule"];
    return {
      start: schedule.start.slice(0, 5),
      end: schedule.end.slice(0, 5),
      break_start: schedule.break_start.slice(0, 5),
      break_end: schedule.break_end.slice(0, 5),
    };
  }

  if (key === "clock_check_window") {
    const window = value as AppSettings["clock_check_window"];
    return { start: window.start.slice(0, 5), end: window.end.slice(0, 5) };
  }

  if (key === "leave_rules") {
    const rules = value as AppSettings["leave_rules"];
    return { mode: rules.mode };
  }

  if (typeof value === "boolean") return { value: value ? "true" : "false" };

  return { value: String(value) };
}

/**
 * Traduit les champs du formulaire vers la valeur à écrire, **validée**.
 *
 * Le schéma Zod du réglage est la même source de vérité que celle qu'utilise
 * `getSettings()` à la lecture : une valeur qui sort d'ici est forcément une
 * valeur que la lecture saura relire.
 */
export function fromFormFields(
  key: SettingsKey,
  fields: Record<string, string>,
  current: AppSettings,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const raw = buildRaw(key, fields, current);
  if (!raw.ok) return raw;

  const parsed = (settingsSchema[key] as z.ZodType).safeParse(raw.value);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Valeur invalide." };
  }

  return { ok: true, value: parsed.data };
}

function buildRaw(
  key: SettingsKey,
  fields: Record<string, string>,
  current: AppSettings,
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (key === "default_schedule" || key === "clock_check_window") {
    const times =
      key === "default_schedule"
        ? (["start", "end", "break_start", "break_end"] as const)
        : (["start", "end"] as const);

    const value: Record<string, string> = {};

    for (const field of times) {
      const raw = fields[field] ?? "";
      if (!TIME.test(raw)) return { ok: false, error: "Les heures doivent être au format HH:MM." };
      value[field] = raw;
    }

    if ((value.end ?? "") <= (value.start ?? "")) {
      return { ok: false, error: "L'heure de fin doit être après l'heure de début." };
    }

    return { ok: true, value };
  }

  if (key === "leave_rules") {
    const mode = fields.mode;
    if (mode !== "ouvrables" && mode !== "ouvres") {
      return { ok: false, error: "Choisissez une règle d'acquisition." };
    }

    // Le mode porte le nombre de jours : les deux ne peuvent pas diverger, et
    // laisser quelqu'un saisir « ouvrés, 2,5 j/mois » serait lui laisser créer
    // une règle qui n'existe pas.
    return {
      ok: true,
      value: {
        ...current.leave_rules,
        mode,
        days_per_month: mode === "ouvrables" ? 2.5 : 2.08,
      },
    };
  }

  const raw = fields.value ?? "";

  if (key === "selfie_required") {
    return { ok: true, value: raw === "true" };
  }

  if (key === "company_name") {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return { ok: false, error: "Le nom ne peut pas être vide." };
    return { ok: true, value: trimmed };
  }

  const numeric = Number(raw.replace(",", "."));
  if (!Number.isFinite(numeric)) return { ok: false, error: "Indiquez un nombre." };

  return { ok: true, value: numeric };
}

/** Le registre ne doit décrire que des réglages qui existent vraiment. */
export function unknownDefinitionKeys(): string[] {
  return SETTING_DEFINITIONS.filter((definition) => !(definition.key in DEFAULT_SETTINGS)).map(
    (definition) => definition.key,
  );
}
