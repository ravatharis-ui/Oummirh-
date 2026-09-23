import { describe, expect, it } from "vitest";

import { hoursCounters } from "../domain/counters";
import { buildHoursDetail, detailTotal, hoursKindLabel } from "../domain/detail";

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

describe("le détail du compteur", () => {
  const worked = new Map([
    ["2026-03-02", 435], // 7 h 15 travaillées
    ["2026-03-03", 405], // 6 h 45 travaillées
  ]);

  it("déduit le prévu du réel et de l'écart, plutôt que de relire le planning", () => {
    // Elle est restée 15 min de plus : 7 h 15 faites pour 7 h prévues.
    const [late] = buildHoursDetail(
      [{ id: "1", kind: "daily_delta", minutes: 15, localDate: "2026-03-02", note: null }],
      worked,
    );

    expect(late?.plannedMinutes).toBe(420);
    expect(late?.workedMinutes).toBe(435);
    expect(late?.minutes).toBe(15);
  });

  it("un retard à l'arrivée donne un écart négatif, et le prévu reste le prévu", () => {
    const [short] = buildHoursDetail(
      [{ id: "2", kind: "daily_delta", minutes: -15, localDate: "2026-03-03", note: null }],
      worked,
    );

    expect(short?.plannedMinutes).toBe(420);
    expect(short?.workedMinutes).toBe(405);
    expect(short?.minutes).toBe(-15);
  });

  it("une récupération ou un ajustement n'affiche ni prévu ni réel", () => {
    // Écrire « prévu 0 h » laisserait croire qu'elle n'était pas attendue.
    const rows = buildHoursDetail(
      [
        { id: "3", kind: "recovery", minutes: -60, localDate: "2026-03-04", note: "Part plus tôt" },
        { id: "4", kind: "adjustment", minutes: 30, localDate: "2026-03-05", note: "Geste" },
      ],
      worked,
    );

    for (const row of rows) {
      expect(row.plannedMinutes).toBeNull();
      expect(row.workedMinutes).toBeNull();
      expect(row.note).not.toBeNull();
    }
  });

  it("une journée dont le temps travaillé est inconnu n'invente pas de prévu", () => {
    const [unknown] = buildHoursDetail(
      [{ id: "5", kind: "daily_delta", minutes: 20, localDate: "2026-09-09", note: null }],
      worked,
    );

    expect(unknown?.plannedMinutes).toBeNull();
    // L'écart, lui, vient du ledger : il reste juste.
    expect(unknown?.minutes).toBe(20);
  });

  it("le total affiché est la somme de ce qui est affiché", () => {
    const rows = buildHoursDetail(
      [
        { id: "6", kind: "daily_delta", minutes: 15, localDate: "2026-03-02", note: null },
        { id: "7", kind: "daily_delta", minutes: -15, localDate: "2026-03-03", note: null },
        { id: "8", kind: "recovery", minutes: -60, localDate: "2026-03-04", note: null },
      ],
      worked,
    );

    expect(detailTotal(rows)).toBe(-60);
  });

  it("chaque nature de mouvement a un libellé en français", () => {
    expect(hoursKindLabel("daily_delta")).toBe("Journée travaillée");
    expect(hoursKindLabel("recovery")).toBe("Récupération prise");
    expect(hoursKindLabel("adjustment")).toBe("Ajustement de la direction");
    // Une nature ajoutée plus tard ne casse pas l'écran.
    expect(hoursKindLabel("quelque_chose")).toBe("Mouvement");
  });
});

describe("les trois chiffres du compteur d'heures", () => {
  it("sépare ce qui a été fait, ce qui reste et ce qui a été repris", () => {
    const counters = hoursCounters(
      [
        { kind: "daily_delta", minutes: 90, localDate: "2026-03-02" },
        { kind: "daily_delta", minutes: -30, localDate: "2026-03-03" },
        { kind: "adjustment", minutes: 15, localDate: "2026-03-04" },
        { kind: "recovery", minutes: -60, localDate: "2026-03-05" },
      ],
      15,
    );

    // 90 − 30 + 15 : les journées et les ajustements de la direction.
    expect(counters.earned).toBe(75);
    // Repris en positif : « heures reprises : −60 » ne veut rien dire.
    expect(counters.used).toBe(60);
    expect(counters.available).toBe(15);
  });

  it("un compteur vide affiche trois zéros, pas trois tirets", () => {
    const counters = hoursCounters([], 0);
    expect(counters).toEqual({ earned: 0, available: 0, used: 0 });
  });

  it("le solde vient de la base, jamais d'une soustraction", () => {
    // La liste affichée est bornée ; recalculer le solde depuis elle le
    // tronquerait, et un compteur faux vaut moins que pas de compteur.
    const counters = hoursCounters(
      [{ kind: "daily_delta", minutes: 30, localDate: "2026-03-02" }],
      999,
    );
    expect(counters.available).toBe(999);
  });
});
