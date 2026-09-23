import { describe, expect, it } from "vitest";

import {
  canAdminDecide,
  canCancel,
  canPartnerAnswer,
  isDaySwappable,
  isSwapStatus,
  swapStatusMeta,
  SWAP_STATUSES,
} from "../domain/status";

describe("le parcours d'un échange", () => {
  it("fait répondre la collègue en premier", () => {
    expect(canPartnerAnswer("pending_partner")).toBe(true);
    expect(canAdminDecide("pending_partner")).toBe(false);
  });

  it("ne laisse la direction trancher qu'ensuite", () => {
    // Demander à la direction d'arbitrer un échange que l'intéressée refusera
    // est une perte de temps pour tout le monde.
    expect(canAdminDecide("pending_admin")).toBe(true);
    expect(canPartnerAnswer("pending_admin")).toBe(false);
  });

  it("ne laisse plus personne répondre une fois la décision prise", () => {
    for (const status of ["approved", "refused_partner", "refused_admin", "cancelled"]) {
      expect(canPartnerAnswer(status)).toBe(false);
      expect(canAdminDecide(status)).toBe(false);
    }
  });
});

describe("canCancel", () => {
  it("laisse annuler tant que rien n'est tranché", () => {
    expect(canCancel("pending_partner")).toBe(true);
    expect(canCancel("pending_admin")).toBe(true);
  });

  it("refuse d'annuler un échange validé", () => {
    // Les deux plannings ont changé, et deux personnes ont organisé leur
    // semaine autour.
    expect(canCancel("approved")).toBe(false);
  });

  it("n'annule pas ce qui est déjà refusé ou annulé", () => {
    expect(canCancel("refused_partner")).toBe(false);
    expect(canCancel("refused_admin")).toBe(false);
    expect(canCancel("cancelled")).toBe(false);
  });
});

describe("isDaySwappable", () => {
  it("accepte une journée de travail, de remplacement ou de repos", () => {
    expect(isDaySwappable("work")).toBe(true);
    expect(isDaySwappable("replacement")).toBe(true);
    expect(isDaySwappable("rest")).toBe(true);
  });

  it("accepte une journée sans planning", () => {
    expect(isDaySwappable(null)).toBe(true);
  });

  it("refuse ce qui a été décidé ailleurs", () => {
    expect(isDaySwappable("leave")).toBe(false);
    expect(isDaySwappable("sick")).toBe(false);
    expect(isDaySwappable("school")).toBe(false);
  });
});

describe("swapStatusMeta", () => {
  it("nomme chaque état pour les trois personnes concernées", () => {
    for (const status of SWAP_STATUSES) {
      const meta = swapStatusMeta(status);
      expect(meta.requesterLabel.length).toBeGreaterThan(3);
      expect(meta.partnerLabel.length).toBeGreaterThan(3);
      expect(meta.adminLabel.length).toBeGreaterThan(3);
    }
  });

  it("ne considère vivants que les deux états d'attente", () => {
    const live = SWAP_STATUSES.filter((status) => swapStatusMeta(status).live);
    expect(live).toEqual(["pending_partner", "pending_admin"]);
  });

  it("retombe sur un état clos pour un statut inconnu", () => {
    expect(isSwapStatus("n'importe quoi")).toBe(false);
    expect(swapStatusMeta("n'importe quoi").live).toBe(false);
  });
});
