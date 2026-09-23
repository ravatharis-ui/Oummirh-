import { describe, expect, it } from "vitest";

import {
  availabilityMeta,
  availabilityRank,
  AVAILABILITY_KINDS,
  isAvailability,
} from "../domain/availability";
import { replacementSchema } from "../schemas";

describe("les disponibilités", () => {
  it("ne laisse choisir que ce qui est choisissable", () => {
    // « Déjà ailleurs ce jour-là » n'est pas un refus : c'est parfois exactement
    // la personne à déplacer. Un congé, lui, en est un.
    expect(availabilityMeta("free").selectable).toBe(true);
    expect(availabilityMeta("working_here").selectable).toBe(true);
    expect(availabilityMeta("working_elsewhere").selectable).toBe(true);
    expect(availabilityMeta("unavailable").selectable).toBe(false);
  });

  it("met les plus faciles à solliciter en premier", () => {
    const sorted = [...AVAILABILITY_KINDS].sort(
      (a, b) => availabilityRank(a) - availabilityRank(b),
    );
    expect(sorted).toEqual(["free", "working_here", "working_elsewhere", "unavailable"]);
  });

  it("traite un état inconnu comme indisponible", () => {
    // Le doute profite à la personne : on ne la dérange pas.
    expect(isAvailability("peut-être")).toBe(false);
    expect(availabilityMeta("peut-être").selectable).toBe(false);
  });

  it("explique chaque état en une phrase", () => {
    for (const kind of AVAILABILITY_KINDS) {
      expect(availabilityMeta(kind).hint.length).toBeGreaterThan(10);
    }
  });
});

describe("replacementSchema", () => {
  const base = {
    boutiqueId: "11111111-1111-4111-8111-111111111111",
    date: "2026-12-21",
    employeeId: "22222222-2222-4222-8222-222222222222",
    startTime: "09:00",
    endTime: "17:30",
  };

  it("accepte un remplacement complet", () => {
    expect(replacementSchema.safeParse(base).success).toBe(true);
  });

  it("refuse une fin avant le début", () => {
    const result = replacementSchema.safeParse({ ...base, startTime: "17:00", endTime: "09:00" });
    expect(result.success).toBe(false);
  });

  it("refuse une demi-pause", () => {
    const result = replacementSchema.safeParse({ ...base, breakStart: "12:30" });
    expect(result.success).toBe(false);
  });

  it("accepte une pause complète", () => {
    const result = replacementSchema.safeParse({
      ...base,
      breakStart: "12:30",
      breakEnd: "14:00",
    });
    expect(result.success).toBe(true);
  });

  it("refuse une date qui n'en est pas une", () => {
    expect(replacementSchema.safeParse({ ...base, date: "demain" }).success).toBe(false);
  });
});
