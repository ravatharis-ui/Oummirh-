import { describe, expect, it } from "vitest";

import { deltaTone, formatDelta } from "../domain/delta";
import {
  CLOCK_EVENTS,
  alternateClockAction,
  isAllowedTransition,
  isClockEventType,
  nextClockAction,
  type ClockEventType,
} from "../domain/sequence";
import { correctionSchema, photoPathSchema } from "../schemas";

describe("nextClockAction", () => {
  it("commence par l'arrivée", () => {
    expect(nextClockAction(null)?.type).toBe("clock_in");
  });

  it("propose la pause après l'arrivée, et le départ en second choix", () => {
    expect(nextClockAction("clock_in")?.type).toBe("break_start");
    expect(alternateClockAction("clock_in")?.type).toBe("clock_out");
  });

  it("impose la fin de pause après son début", () => {
    expect(nextClockAction("break_start")?.type).toBe("break_end");
    expect(alternateClockAction("break_start")).toBeNull();
  });

  it("ne propose plus rien après le départ", () => {
    expect(nextClockAction("clock_out")).toBeNull();
  });

  it("ne demande de photo que pour l'arrivée", () => {
    expect(nextClockAction(null)?.needsPhoto).toBe(true);
    expect(nextClockAction("clock_in")?.needsPhoto).toBe(false);
    expect(nextClockAction("break_end")?.needsPhoto).toBe(true);
    // The departure carries a photo too: it is the other end of the day.
    expect(alternateClockAction("clock_in")?.needsPhoto).toBe(true);
  });
});

describe("isAllowedTransition", () => {
  // La même table que celle que `clock_event` applique en SQL. Si les deux
  // divergent, l'écran proposera un bouton que la base refusera.
  const allowed: [ClockEventType | null, ClockEventType][] = [
    [null, "clock_in"],
    ["clock_in", "break_start"],
    ["clock_in", "clock_out"],
    ["break_start", "break_end"],
    ["break_end", "clock_out"],
  ];

  it("accepte exactement les cinq enchaînements légitimes", () => {
    const states: (ClockEventType | null)[] = [null, ...CLOCK_EVENTS];
    let accepted = 0;

    for (const from of states) {
      for (const to of CLOCK_EVENTS) {
        if (isAllowedTransition(from, to)) accepted += 1;
      }
    }

    expect(accepted).toBe(allowed.length);
  });

  it("refuse une seconde arrivée", () => {
    expect(isAllowedTransition("clock_in", "clock_in")).toBe(false);
  });

  it("refuse de partir en laissant sa pause ouverte", () => {
    expect(isAllowedTransition("break_start", "clock_out")).toBe(false);
  });

  it("refuse tout après le départ", () => {
    for (const to of CLOCK_EVENTS) {
      expect(isAllowedTransition("clock_out", to)).toBe(false);
    }
  });
});

describe("isClockEventType", () => {
  it("refuse ce que la base refuserait", () => {
    expect(isClockEventType("sieste")).toBe(false);
    expect(isClockEventType("clock_in")).toBe(true);
  });
});

describe("formatDelta", () => {
  it("considère à l'heure tout ce qui tient dans la tolérance", () => {
    expect(formatDelta(0)).toBe("à l'heure");
    expect(formatDelta(9)).toBe("à l'heure");
    expect(formatDelta(-9)).toBe("à l'heure");
  });

  it("nomme un retard et une avance", () => {
    expect(formatDelta(25)).toBe("25 min de retard");
    expect(formatDelta(-25)).toBe("25 min d'avance");
    expect(formatDelta(95)).toBe("1 h 35 de retard");
  });

  it("ne juge pas une journée sans horaire prévu", () => {
    expect(formatDelta(null)).toBe("heure non prévue");
    expect(deltaTone(null)).toBe("unknown");
  });

  it("suit la tolérance configurée", () => {
    expect(deltaTone(12, 10)).toBe("late");
    expect(deltaTone(12, 15)).toBe("onTime");
  });
});

describe("photoPathSchema", () => {
  const employeeId = "11111111-1111-4111-8111-111111111111";

  it("accepte un chemin rangé dans le dossier d'une collaboratrice", () => {
    expect(photoPathSchema.safeParse(`${employeeId}/abc-123.jpg`).success).toBe(true);
  });

  it("refuse un chemin qui remonte hors du dossier", () => {
    expect(photoPathSchema.safeParse("../autre/photo.jpg").success).toBe(false);
  });

  it("refuse un fichier qui n'est pas une photo", () => {
    expect(photoPathSchema.safeParse(`${employeeId}/script.js`).success).toBe(false);
  });
});

describe("correctionSchema", () => {
  const base = {
    employeeId: "11111111-1111-4111-8111-111111111111",
    localDate: "2026-09-21",
    eventType: "clock_in" as const,
    time: "09:00",
  };

  it("exige un motif", () => {
    expect(correctionSchema.safeParse({ ...base, reason: "" }).success).toBe(false);
    expect(correctionSchema.safeParse({ ...base, reason: "ok" }).success).toBe(false);
  });

  it("accepte une correction motivée", () => {
    const result = correctionSchema.safeParse({
      ...base,
      reason: "Téléphone déchargé, arrivée constatée à 9 h",
    });
    expect(result.success).toBe(true);
  });
});
