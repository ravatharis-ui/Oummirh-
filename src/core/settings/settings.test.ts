import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  disabledModuleKeys,
  parseSettingsRows,
  type SettingRow,
} from "./schemas";
import {
  fromFormFields,
  SETTING_DEFINITIONS,
  SETTING_GROUPS,
  toFormFields,
  unknownDefinitionKeys,
} from "./registry";

const validRows: SettingRow[] = [
  { key: "company_name", value: "Oummi Dressing" },
  { key: "timezone", value: "Indian/Reunion" },
  {
    key: "default_schedule",
    value: { start: "09:30", end: "18:00", break_start: "12:30", break_end: "14:00" },
  },
  {
    key: "leave_rules",
    value: {
      mode: "ouvres",
      days_per_month: 2.08,
      period_start_month: 6,
      period_start_day: 1,
      carry_over: false,
    },
  },
  { key: "late_tolerance_minutes", value: 15 },
  { key: "selfie_retention_days", value: 30 },
  { key: "selfie_required", value: false },
  { key: "missing_clock_out_delay_minutes", value: 90 },
  { key: "clock_check_window", value: { start: "06:30", end: "21:00" } },
  { key: "overtime_recovery_min_step_minutes", value: 15 },
  { key: "modules_enabled", value: { conges: true, swaps: false } },
];

describe("parseSettingsRows", () => {
  it("reads every setting from well-formed rows", () => {
    const { settings, problems } = parseSettingsRows(validRows);
    expect(problems).toEqual([]);
    expect(settings.default_schedule.start).toBe("09:30");
    expect(settings.leave_rules.mode).toBe("ouvres");
    expect(settings.late_tolerance_minutes).toBe(15);
    expect(settings.modules_enabled).toEqual({ conges: true, swaps: false });
  });

  it("falls back to the default for a missing key and says so", () => {
    const rows = validRows.filter((row) => row.key !== "late_tolerance_minutes");
    const { settings, problems } = parseSettingsRows(rows);
    expect(settings.late_tolerance_minutes).toBe(DEFAULT_SETTINGS.late_tolerance_minutes);
    expect(problems).toContain("Réglage manquant : late_tolerance_minutes");
  });

  it("falls back to the default for a malformed value without losing the others", () => {
    const rows: SettingRow[] = [
      ...validRows.filter((row) => row.key !== "leave_rules"),
      { key: "leave_rules", value: { mode: "fantaisiste" } },
    ];
    const { settings, problems } = parseSettingsRows(rows);
    expect(settings.leave_rules).toEqual(DEFAULT_SETTINGS.leave_rules);
    expect(settings.selfie_retention_days).toBe(30);
    expect(problems).toContain("Réglage invalide : leave_rules");
  });

  it("returns every default when the table is empty", () => {
    const { settings, problems } = parseSettingsRows([]);
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(problems).toHaveLength(Object.keys(DEFAULT_SETTINGS).length);
  });

  it("rejects an out-of-range tolerance", () => {
    const rows: SettingRow[] = [
      ...validRows.filter((row) => row.key !== "late_tolerance_minutes"),
      { key: "late_tolerance_minutes", value: -5 },
    ];
    const { problems } = parseSettingsRows(rows);
    expect(problems).toContain("Réglage invalide : late_tolerance_minutes");
  });
});

describe("disabledModuleKeys", () => {
  it("lists only the modules explicitly switched off", () => {
    const { settings } = parseSettingsRows(validRows);
    expect(disabledModuleKeys(settings)).toEqual(new Set(["swaps"]));
  });

  it("treats an absent module as enabled", () => {
    const { settings } = parseSettingsRows([]);
    expect(disabledModuleKeys(settings).size).toBe(0);
  });
});

describe("registre des réglages", () => {
  it("ne décrit que des réglages qui existent vraiment", () => {
    // Une faute de frappe dans une clé ferait un champ que personne ne lit et
    // que la base refuserait d'écrire. Le test l'attrape avant l'écran.
    expect(unknownDefinitionKeys()).toEqual([]);
  });

  it("range chaque réglage dans un groupe connu", () => {
    const groups = new Set(SETTING_GROUPS.map((group) => group.key));
    for (const definition of SETTING_DEFINITIONS) {
      expect(groups.has(definition.group)).toBe(true);
    }
  });

  it("donne à chaque réglage un libellé et une aide", () => {
    for (const definition of SETTING_DEFINITIONS) {
      expect(definition.label.length).toBeGreaterThan(2);
      expect(definition.help.length).toBeGreaterThan(10);
    }
  });

  it("fait l'aller-retour formulaire pour chaque réglage décrit", () => {
    // La valeur par défaut part vers le formulaire, revient, et doit être
    // acceptée : c'est ce qui garantit qu'un gérant peut rouvrir un écran et
    // réenregistrer sans rien casser.
    for (const definition of SETTING_DEFINITIONS) {
      const fields = toFormFields(definition.key, DEFAULT_SETTINGS);
      const result = fromFormFields(definition.key, fields, DEFAULT_SETTINGS);
      expect(result.ok, `aller-retour cassé pour ${definition.key}`).toBe(true);
    }
  });

  it("refuse une fenêtre horaire qui finit avant de commencer", () => {
    const result = fromFormFields(
      "clock_check_window",
      { start: "20:00", end: "07:00" },
      DEFAULT_SETTINGS,
    );
    expect(result.ok).toBe(false);
  });

  it("refuse un nom d'entreprise vide", () => {
    expect(fromFormFields("company_name", { value: "   " }, DEFAULT_SETTINGS).ok).toBe(false);
  });

  it("refuse une tolérance de retard qui n'est pas un nombre", () => {
    expect(
      fromFormFields("late_tolerance_minutes", { value: "beaucoup" }, DEFAULT_SETTINGS).ok,
    ).toBe(false);
  });

  it("accepte une décimale écrite à la française", () => {
    const result = fromFormFields("selfie_retention_days", { value: "90" }, DEFAULT_SETTINGS);
    expect(result).toEqual({ ok: true, value: 90 });
  });

  it("garde le mode et le nombre de jours cohérents entre eux", () => {
    // Personne ne doit pouvoir enregistrer « jours ouvrés, 2,5 j/mois » : cette
    // règle-là n'existe pas, et c'est exactement l'incohérence de la V1.
    const ouvres = fromFormFields("leave_rules", { mode: "ouvres" }, DEFAULT_SETTINGS);
    expect(ouvres.ok && (ouvres.value as { days_per_month: number }).days_per_month).toBe(2.08);

    const ouvrables = fromFormFields("leave_rules", { mode: "ouvrables" }, DEFAULT_SETTINGS);
    expect(ouvrables.ok && (ouvrables.value as { days_per_month: number }).days_per_month).toBe(
      2.5,
    );
  });

  it("conserve les réglages de période que l'écran ne montre pas", () => {
    const result = fromFormFields("leave_rules", { mode: "ouvres" }, DEFAULT_SETTINGS);
    expect(result.ok && (result.value as { period_start_month: number }).period_start_month).toBe(
      6,
    );
  });
});
