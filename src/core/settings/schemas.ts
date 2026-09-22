import { z } from "zod";

/**
 * Application settings.
 *
 * Each key is validated independently so that one malformed row cannot take the
 * whole application down: `parseSettingsRows` falls back to the documented default
 * for that key and reports the problem. Defaults here must mirror
 * supabase/migrations/0002_core_reference_data.sql.
 */
const timePattern = /^\d{2}:\d{2}(:\d{2})?$/;

export const scheduleSchema = z.object({
  start: z.string().regex(timePattern),
  end: z.string().regex(timePattern),
  break_start: z.string().regex(timePattern),
  break_end: z.string().regex(timePattern),
});

/**
 * `ouvrables` — 2,5 jours / mois, 30 jours / an, lundi→samedi hors fériés.
 * `ouvres`    — 2,08 jours / mois, 25 jours / an, lundi→vendredi hors fériés.
 */
export const leaveRulesSchema = z.object({
  mode: z.enum(["ouvrables", "ouvres"]),
  days_per_month: z.number().positive(),
  period_start_month: z.number().int().min(1).max(12),
  period_start_day: z.number().int().min(1).max(31),
  carry_over: z.boolean(),
});

export const settingsSchema = {
  company_name: z.string().min(1),
  timezone: z.string().min(1),
  default_schedule: scheduleSchema,
  leave_rules: leaveRulesSchema,
  late_tolerance_minutes: z.number().int().min(0),
  selfie_retention_days: z.number().int().positive(),
  overtime_recovery_min_step_minutes: z.number().int().positive(),
  modules_enabled: z.record(z.string(), z.boolean()),
} as const;

export type SettingsKey = keyof typeof settingsSchema;

export type AppSettings = {
  [K in SettingsKey]: z.infer<(typeof settingsSchema)[K]>;
};

export const DEFAULT_SETTINGS: AppSettings = {
  company_name: "Oummi Dressing",
  timezone: "Indian/Reunion",
  default_schedule: { start: "09:00", end: "17:30", break_start: "12:30", break_end: "14:00" },
  leave_rules: {
    mode: "ouvrables",
    days_per_month: 2.5,
    period_start_month: 6,
    period_start_day: 1,
    carry_over: true,
  },
  late_tolerance_minutes: 10,
  selfie_retention_days: 60,
  overtime_recovery_min_step_minutes: 15,
  modules_enabled: {},
};

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface ParsedSettings {
  settings: AppSettings;
  /** Keys that were missing or malformed and fell back to their default. */
  problems: string[];
}

/** Pure: turns raw `settings` rows into a fully populated, typed object. */
export function parseSettingsRows(rows: readonly SettingRow[]): ParsedSettings {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const settings = { ...DEFAULT_SETTINGS };
  const problems: string[] = [];

  for (const key of Object.keys(settingsSchema) as SettingsKey[]) {
    if (!byKey.has(key)) {
      problems.push(`Réglage manquant : ${key}`);
      continue;
    }

    const parsed = settingsSchema[key].safeParse(byKey.get(key));
    if (parsed.success) {
      // Each key is validated by its own schema, so the value matches AppSettings[key].
      Object.assign(settings, { [key]: parsed.data });
    } else {
      problems.push(`Réglage invalide : ${key}`);
    }
  }

  return { settings, problems };
}

/** Module keys explicitly switched off in `modules_enabled`. Absent means enabled. */
export function disabledModuleKeys(settings: AppSettings): Set<string> {
  return new Set(
    Object.entries(settings.modules_enabled)
      .filter(([, enabled]) => !enabled)
      .map(([key]) => key),
  );
}
