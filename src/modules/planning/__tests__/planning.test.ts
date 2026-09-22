import { describe, expect, it } from "vitest";

import { isProtectedSource, statusMeta, QUICK_PRESETS } from "../domain/status";
import { dayMinutes, weekBalanceMinutes, weekMinutes, type PlannedDay } from "../domain/week";
import { planningEntrySchema } from "../schemas";

function day(overrides: Partial<PlannedDay> = {}): PlannedDay {
  return {
    date: "2026-09-21",
    status: "work",
    startTime: "09:00",
    endTime: "17:30",
    breakStart: "12:30",
    breakEnd: "14:00",
    ...overrides,
  };
}

describe("dayMinutes", () => {
  it("déduit la pause d'une journée travaillée", () => {
    expect(dayMinutes(day())).toBe(420);
  });

  it("compte la journée entière quand aucune pause n'est saisie", () => {
    expect(dayMinutes(day({ breakStart: null, breakEnd: null }))).toBe(510);
  });

  it("compte un remplacement comme du travail", () => {
    expect(dayMinutes(day({ status: "replacement" }))).toBe(420);
  });

  it("ne compte ni l'école ni le repos ni le congé", () => {
    for (const status of ["school", "rest", "leave", "sick", "other"]) {
      expect(dayMinutes(day({ status }))).toBe(0);
    }
  });

  it("ne compte rien sans horaires", () => {
    expect(dayMinutes(day({ startTime: null, endTime: null }))).toBe(0);
  });
});

describe("weekMinutes", () => {
  it("additionne les journées travaillées", () => {
    const week = [day(), day({ date: "2026-09-22" }), day({ date: "2026-09-23", status: "rest" })];
    expect(weekMinutes(week)).toBe(840);
  });

  it("vaut zéro pour une semaine vide", () => {
    expect(weekMinutes([])).toBe(0);
  });
});

describe("weekBalanceMinutes", () => {
  it("compare au contrat", () => {
    const week = [day(), day({ date: "2026-09-22" })];
    expect(weekBalanceMinutes(week, 35)).toBe(840 - 2100);
  });

  it("ne dit rien quand le contrat est inconnu", () => {
    // Afficher « -35 h » pour quelqu'un dont on ignore le contrat serait une
    // accusation, pas une information.
    expect(weekBalanceMinutes([day()], null)).toBeNull();
  });
});

describe("statuts", () => {
  it("retombe sur « Autre » pour un statut inconnu", () => {
    expect(statusMeta("n'importe quoi").label).toBe("Autre");
  });

  it("protège les journées posées par un congé, un remplacement ou un échange", () => {
    expect(isProtectedSource("leave")).toBe(true);
    expect(isProtectedSource("replacement")).toBe(true);
    expect(isProtectedSource("swap")).toBe(true);
    expect(isProtectedSource("manual")).toBe(false);
    expect(isProtectedSource("template")).toBe(false);
  });

  it("n'offre que des raccourcis dont le statut existe", () => {
    for (const preset of QUICK_PRESETS) {
      expect(statusMeta(preset.status).label).not.toBe("Autre");
      if (statusMeta(preset.status).needsHours) {
        expect(preset.start).toBeDefined();
        expect(preset.end).toBeDefined();
      }
    }
  });
});

describe("planningEntrySchema", () => {
  const base = {
    employeeId: "11111111-1111-4111-8111-111111111111",
    date: "2026-09-21",
  };

  it("accepte une journée travaillée complète", () => {
    const result = planningEntrySchema.safeParse({
      ...base,
      status: "work",
      startTime: "09:00",
      endTime: "17:30",
    });
    expect(result.success).toBe(true);
  });

  it("refuse une journée travaillée sans horaires", () => {
    const result = planningEntrySchema.safeParse({ ...base, status: "work" });
    expect(result.success).toBe(false);
  });

  it("accepte un repos sans horaires", () => {
    expect(planningEntrySchema.safeParse({ ...base, status: "rest" }).success).toBe(true);
  });

  it("refuse une fin avant le début", () => {
    const result = planningEntrySchema.safeParse({
      ...base,
      status: "work",
      startTime: "17:00",
      endTime: "09:00",
    });
    expect(result.success).toBe(false);
  });

  it("refuse une demi-pause", () => {
    const result = planningEntrySchema.safeParse({
      ...base,
      status: "work",
      startTime: "09:00",
      endTime: "17:30",
      breakStart: "12:30",
    });
    expect(result.success).toBe(false);
  });

  it("refuse un statut que la base refuserait aussi", () => {
    expect(planningEntrySchema.safeParse({ ...base, status: "vacances" }).success).toBe(false);
  });
});
