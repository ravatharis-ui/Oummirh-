import { describe, expect, it } from "vitest";

import { cumulativeMinutes, monthlyTotals, toCsv, type HoursMovement } from "../domain/monthly";
import {
  availableMinutes,
  balanceTone,
  checkRecoveryRequest,
  formatBalance,
  isRecoveryMode,
  offeredDurations,
} from "../domain/recovery";

describe("availableMinutes", () => {
  it("retire du solde ce qui est déjà demandé", () => {
    expect(availableMinutes(180, 60)).toBe(120);
  });

  it("ne descend jamais sous zéro", () => {
    // Trois demandes de deux heures sur un solde de deux heures : la troisième
    // ne doit rien pouvoir prendre.
    expect(availableMinutes(120, 240)).toBe(0);
  });

  it("laisse le solde entier quand rien n'est en attente", () => {
    expect(availableMinutes(120, 0)).toBe(120);
  });
});

describe("checkRecoveryRequest", () => {
  it("accepte une durée en tranches de quinze minutes dans le solde", () => {
    expect(checkRecoveryRequest(60, 120).ok).toBe(true);
    expect(checkRecoveryRequest(15, 15).ok).toBe(true);
  });

  it("refuse une durée qui n'est pas un multiple de quinze", () => {
    const result = checkRecoveryRequest(20, 120);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("quinze minutes");
  });

  it("refuse plus que le solde disponible", () => {
    const result = checkRecoveryRequest(180, 120);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("2 h");
  });

  it("refuse zéro et le négatif", () => {
    expect(checkRecoveryRequest(0, 120).ok).toBe(false);
    expect(checkRecoveryRequest(-60, 120).ok).toBe(false);
  });
});

describe("offeredDurations", () => {
  it("ne propose jamais plus que le solde", () => {
    expect(offeredDurations(45)).toEqual([15, 30, 45]);
  });

  it("ne propose rien quand il n'y a rien à prendre", () => {
    expect(offeredDurations(0)).toEqual([]);
    expect(offeredDurations(10)).toEqual([]);
  });
});

describe("formatBalance", () => {
  it("montre le signe d'un crédit", () => {
    expect(formatBalance(225)).toBe("+3 h 45");
  });

  it("montre le signe d'une dette", () => {
    expect(formatBalance(-75)).toBe("-1 h 15");
  });

  it("dit zéro sans signe", () => {
    expect(formatBalance(0)).toBe("0 h");
  });

  it("nomme le ton du solde", () => {
    expect(balanceTone(60)).toBe("credit");
    expect(balanceTone(-60)).toBe("debt");
    expect(balanceTone(0)).toBe("neutral");
  });
});

describe("isRecoveryMode", () => {
  it("n'accepte que les deux modes réels", () => {
    expect(isRecoveryMode("later")).toBe(true);
    expect(isRecoveryMode("earlier")).toBe(true);
    expect(isRecoveryMode("jamais")).toBe(false);
  });
});

describe("monthlyTotals", () => {
  const movements: HoursMovement[] = [
    { kind: "daily_delta", minutes: 60, localDate: "2026-03-02" },
    { kind: "daily_delta", minutes: -30, localDate: "2026-03-03" },
    { kind: "recovery", minutes: -60, localDate: "2026-03-10" },
    { kind: "adjustment", minutes: 120, localDate: "2026-03-15" },
    { kind: "daily_delta", minutes: 999, localDate: "2026-04-01" },
  ];

  it("sépare les natures de mouvement", () => {
    const totals = monthlyTotals(movements, "2026-03-01");
    expect(totals.dailyMinutes).toBe(30);
    expect(totals.recoveryMinutes).toBe(-60);
    expect(totals.adjustmentMinutes).toBe(120);
  });

  it("additionne les trois en total du mois", () => {
    expect(monthlyTotals(movements, "2026-03-01").monthMinutes).toBe(90);
  });

  it("ignore les autres mois", () => {
    // Avril ne doit pas déteindre sur mars, et réciproquement.
    expect(monthlyTotals(movements, "2026-04-01").dailyMinutes).toBe(999);
  });

  it("rend zéro pour un mois sans mouvement", () => {
    expect(monthlyTotals(movements, "2026-05-01").monthMinutes).toBe(0);
  });

  it("cumule tout, sans filtre de mois", () => {
    expect(cumulativeMinutes(movements)).toBe(1089);
  });
});

describe("toCsv", () => {
  it("sépare par point-virgule, comme Excel en français l'attend", () => {
    expect(
      toCsv([
        ["Nom", "Solde"],
        ["Anna", 1.5],
      ]),
    ).toBe("Nom;Solde\r\nAnna;1,5");
  });

  it("protège une cellule qui contient un point-virgule", () => {
    expect(toCsv([["a;b", "c"]])).toBe('"a;b";c');
  });

  it("double les guillemets d'une cellule", () => {
    expect(toCsv([['il a dit "oui"']])).toBe('"il a dit ""oui"""');
  });
});
