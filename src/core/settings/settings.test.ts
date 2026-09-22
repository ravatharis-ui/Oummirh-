import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  disabledModuleKeys,
  parseSettingsRows,
  type SettingRow,
} from "./schemas";

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
