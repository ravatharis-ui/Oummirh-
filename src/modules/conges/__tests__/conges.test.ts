import { describe, expect, it } from "vitest";

import { leaveCounters } from "../domain/counters";
import type { LeaveMovement } from "../types";

import { countLeaveDays, formatLeaveDays } from "../domain/count";
import { DEFAULT_LEAVE_RULES, monthlyAccrual, periodLabel, periodStart } from "../domain/period";

// Jours fériés 2026-2027 à La Réunion, tels que la migration de référence les pose.
const HOLIDAYS = ["2026-12-25", "2026-05-01", "2026-12-20", "2027-12-20"];

function count(
  from: string,
  to: string,
  extra: Partial<Parameters<typeof countLeaveDays>[0]> = {},
) {
  return countLeaveDays({ from, to, holidays: HOLIDAYS, nonWorkingDays: [], ...extra });
}

describe("countLeaveDays — la semaine", () => {
  it("compte six jours ouvrables sur une semaine entière", () => {
    // Lundi 7 au dimanche 13 décembre 2026.
    expect(count("2026-12-07", "2026-12-13")).toBe(6);
  });

  it("ne compte jamais le dimanche", () => {
    expect(count("2026-12-13", "2026-12-13")).toBe(0);
  });

  it("compte le samedi en mode ouvrables", () => {
    expect(count("2026-12-12", "2026-12-12")).toBe(1);
  });

  it("ne compte pas le samedi en mode ouvrés", () => {
    const rules = { ...DEFAULT_LEAVE_RULES, mode: "ouvres" as const };
    expect(count("2026-12-12", "2026-12-12", { rules })).toBe(0);
    expect(count("2026-12-07", "2026-12-13", { rules })).toBe(5);
  });
});

describe("countLeaveDays — les jours fériés", () => {
  it("retire le 20 décembre, abolition de l'esclavage", () => {
    // En 2027 il tombe un lundi : le test porte bien sur le férié, pas sur le jour.
    expect(count("2027-12-20", "2027-12-20")).toBe(0);
  });

  it("retire Noël d'une semaine complète", () => {
    // Lundi 21 au samedi 26 décembre 2026 : six jours, moins le vendredi 25.
    expect(count("2026-12-21", "2026-12-26")).toBe(5);
  });

  it("ne retire pas un férié qui tombe déjà un dimanche", () => {
    // Le 20 décembre 2026 est un dimanche : il ne comptait déjà pas.
    expect(count("2026-12-19", "2026-12-21")).toBe(2);
  });
});

describe("countLeaveDays — les jours non travaillés", () => {
  it("ne facture pas un jour de repos planifié", () => {
    expect(count("2026-12-07", "2026-12-13", { nonWorkingDays: ["2026-12-08"] })).toBe(5);
  });

  it("ne facture pas un jour d'école", () => {
    expect(
      count("2026-12-07", "2026-12-13", { nonWorkingDays: ["2026-12-08", "2026-12-09"] }),
    ).toBe(4);
  });
});

describe("countLeaveDays — les demi-journées", () => {
  it("retire une demi-journée quand elle part l'après-midi", () => {
    expect(count("2026-12-07", "2026-12-11", { startHalf: "pm" })).toBe(4.5);
  });

  it("retire une demi-journée quand elle revient l'après-midi", () => {
    expect(count("2026-12-07", "2026-12-11", { endHalf: "am" })).toBe(4.5);
  });

  it("cumule les deux demi-journées", () => {
    expect(count("2026-12-07", "2026-12-11", { startHalf: "pm", endHalf: "am" })).toBe(4);
  });

  it("ne retire qu'une seule demi-journée sur une journée unique", () => {
    expect(count("2026-12-07", "2026-12-07", { startHalf: "pm" })).toBe(0.5);
    expect(count("2026-12-07", "2026-12-07", { startHalf: "pm", endHalf: "am" })).toBe(0.5);
  });

  it("ne retire rien d'un jour qui ne comptait pas", () => {
    expect(count("2026-12-13", "2026-12-13", { startHalf: "pm" })).toBe(0);
    // Le premier jour est un dimanche : la demi-journée ne s'applique pas.
    expect(count("2026-12-13", "2026-12-16", { startHalf: "pm" })).toBe(3);
  });

  it("ne descend jamais sous zéro", () => {
    expect(count("2026-12-25", "2026-12-25", { startHalf: "pm" })).toBe(0);
  });
});

describe("periodStart — la période juin → mai", () => {
  it("rattache septembre à la période ouverte le 1er juin de la même année", () => {
    expect(periodStart("2026-09-21")).toBe("2026-06-01");
  });

  it("rattache mars à la période ouverte l'année précédente", () => {
    expect(periodStart("2026-03-15")).toBe("2025-06-01");
  });

  it("fait du 1er juin le premier jour de sa propre période", () => {
    expect(periodStart("2026-06-01")).toBe("2026-06-01");
  });

  it("fait du 31 mai le dernier jour de la période précédente", () => {
    expect(periodStart("2026-05-31")).toBe("2025-06-01");
  });

  it("se nomme en toutes lettres", () => {
    expect(periodLabel("2026-06-01")).toBe("juin 2026 → mai 2027");
  });
});

describe("monthlyAccrual — le prorata d'embauche", () => {
  it("donne le mois entier à qui était déjà là", () => {
    expect(monthlyAccrual("2026-11-01", "2020-01-01")).toBe(2.5);
    expect(monthlyAccrual("2026-11-01", null)).toBe(2.5);
  });

  it("donne le mois entier à qui arrive le premier jour", () => {
    expect(monthlyAccrual("2026-11-01", "2026-11-01")).toBe(2.5);
  });

  it("proratise une embauche en cours de mois", () => {
    // Embauchée le 16 novembre : 15 jours sur 30, soit la moitié.
    expect(monthlyAccrual("2026-11-01", "2026-11-16")).toBe(1.25);
  });

  it("ne donne rien à qui n'est pas encore arrivée", () => {
    expect(monthlyAccrual("2026-11-01", "2026-12-01")).toBe(0);
  });

  it("tient compte de la longueur réelle du mois", () => {
    // Février 2027 : 28 jours. Arrivée le 15 → 14 jours restants.
    expect(monthlyAccrual("2027-02-01", "2027-02-15")).toBe(1.25);
  });
});

describe("formatLeaveDays", () => {
  it("écrit les jours à la française", () => {
    expect(formatLeaveDays(1)).toBe("1 jour");
    expect(formatLeaveDays(3)).toBe("3 jours");
    expect(formatLeaveDays(2.5)).toBe("2,5 jours");
    expect(formatLeaveDays(0.5)).toBe("0,5 jour");
  });
});

describe("les trois chiffres du compteur de congés", () => {
  const PERIOD = "2026-06-01";

  function movement(kind: string, days: number, occurredOn: string): LeaveMovement {
    return { id: `${kind}-${occurredOn}`, kind, days, occurredOn, note: null };
  }

  it("sépare ce qui est acquis, ce qui reste et ce qui est pris", () => {
    const counters = leaveCounters(
      [
        movement("accrual", 2.5, "2026-06-30"),
        movement("accrual", 2.5, "2026-07-31"),
        movement("taken", -3, "2026-07-15"),
      ],
      PERIOD,
      12,
    );

    expect(counters.earned).toBe(5);
    expect(counters.used).toBe(3);
    // Le solde vient de la base, pas d'une soustraction : il porte le report.
    expect(counters.available).toBe(12);
  });

  it("les jours pris s'affichent en positif", () => {
    // Le registre les écrit en négatif ; « jours pris : −3 » ne veut rien dire.
    const counters = leaveCounters([movement("taken", -3, "2026-07-15")], PERIOD, 0);
    expect(counters.used).toBe(3);
  });

  it("le report entrant compte comme acquis", () => {
    const counters = leaveCounters([movement("carry_over", 4, "2026-06-01")], PERIOD, 4);
    expect(counters.earned).toBe(4);
  });

  it("la période précédente ne pollue pas celle qu'on regarde", () => {
    const counters = leaveCounters(
      [
        movement("accrual", 2.5, "2026-05-31"), // période d'avant
        movement("accrual", 2.5, "2026-06-30"), // celle-ci
        movement("accrual", 2.5, "2027-06-30"), // celle d'après
      ],
      PERIOD,
      7.5,
    );

    expect(counters.earned).toBe(2.5);
  });

  it("une expiration n'est ni acquise ni prise", () => {
    // Des jours perdus au changement de période ne sont pas des jours utilisés :
    // les compter ainsi laisserait croire qu'elle en a profité.
    const counters = leaveCounters(
      [movement("accrual", 2.5, "2026-06-30"), movement("expiry", -5, "2026-06-01")],
      PERIOD,
      0,
    );

    expect(counters.earned).toBe(2.5);
    expect(counters.used).toBe(0);
  });
});
