import { describe, expect, it } from "vitest";

import {
  addDays,
  eachDateInRange,
  formatDuration,
  formatFrDate,
  formatFrDateShort,
  formatFrDateWithYear,
  formatRelativeFr,
  formatFrMonth,
  formatSignedDuration,
  formatTime,
  isWeekend,
  isoWeekDates,
  isoWeekday,
  minutesToTimeString,
  parseDateString,
  parseTimeToMinutes,
  startOfIsoWeek,
  toDateString,
  toReunionDateString,
  toReunionTimeString,
  todayInReunion,
  workedMinutes,
} from "./index";

describe("dates", () => {
  it("parses and round-trips a calendar date", () => {
    expect(toDateString(parseDateString("2026-09-21"))).toBe("2026-09-21");
  });

  it("rejects a malformed date", () => {
    expect(() => parseDateString("21/09/2026")).toThrow(/Format attendu/);
    expect(() => parseDateString("2026-9-1")).toThrow(/Format attendu/);
  });

  it("rejects a day that does not exist instead of rolling it over", () => {
    expect(() => parseDateString("2026-02-31")).toThrow(/inexistante/);
    expect(() => parseDateString("2026-13-01")).toThrow(/inexistante/);
  });

  it("accepts 29 February in a leap year", () => {
    expect(toDateString(parseDateString("2028-02-29"))).toBe("2028-02-29");
  });

  it("resolves an instant to the Réunion calendar day, not the UTC one", () => {
    // Réunion is UTC+4: 20:00 UTC is already midnight of the next day on the island.
    expect(toReunionDateString(new Date("2026-09-21T19:59:00Z"))).toBe("2026-09-21");
    expect(toReunionDateString(new Date("2026-09-21T20:00:00Z"))).toBe("2026-09-22");
  });

  it("resolves an instant to the Réunion wall clock", () => {
    expect(toReunionTimeString(new Date("2026-09-21T05:30:00Z"))).toBe("09:30");
  });

  it("reports today in Réunion from an injected clock", () => {
    expect(todayInReunion(new Date("2026-09-21T21:00:00Z"))).toBe("2026-09-22");
  });

  it("adds and subtracts days across month and year boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-09-21", 0)).toBe("2026-09-21");
  });

  it("numbers weekdays from Monday", () => {
    expect(isoWeekday("2026-09-21")).toBe(1);
    expect(isoWeekday("2026-09-22")).toBe(2);
    expect(isoWeekday("2026-12-20")).toBe(7);
  });

  it("finds the Monday of a week", () => {
    expect(startOfIsoWeek("2026-09-24")).toBe("2026-09-21");
    expect(startOfIsoWeek("2026-09-21")).toBe("2026-09-21");
    expect(startOfIsoWeek("2026-09-27")).toBe("2026-09-21");
  });

  it("lists the seven days of a week, Monday first", () => {
    expect(isoWeekDates("2026-09-24")).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
  });

  it("lists every day of an inclusive range", () => {
    expect(eachDateInRange("2026-09-21", "2026-09-23")).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
    ]);
    expect(eachDateInRange("2026-09-21", "2026-09-21")).toEqual(["2026-09-21"]);
  });

  it("refuses a range that ends before it starts", () => {
    expect(() => eachDateInRange("2026-09-23", "2026-09-21")).toThrow(/Période invalide/);
  });

  it("recognises weekends", () => {
    expect(isWeekend("2026-09-25")).toBe(false);
    expect(isWeekend("2026-09-26")).toBe(true);
    expect(isWeekend("2026-09-27")).toBe(true);
  });

  it("formats dates in French", () => {
    expect(formatFrDate("2026-09-21")).toBe("lundi 21 septembre");
    expect(formatFrDateWithYear("2026-09-21")).toBe("lundi 21 septembre 2026");
    expect(formatFrDateShort("2026-09-21")).toBe("21/09/2026");
    expect(formatFrMonth("2026-09-21")).toBe("septembre 2026");
  });
});

describe("formatRelativeFr", () => {
  const now = new Date("2026-09-22T12:00:00Z");

  it("écrit « à l'instant » pour les moins d'une minute", () => {
    expect(formatRelativeFr("2026-09-22T11:59:30Z", now)).toBe("à l'instant");
    expect(formatRelativeFr("2026-09-22T12:00:00Z", now)).toBe("à l'instant");
  });

  it("traite une horloge en avance comme l'instant présent", () => {
    // Le téléphone d'une collaboratrice peut être légèrement en avance ;
    // « dans 3 minutes » sur une notification reçue serait déroutant.
    expect(formatRelativeFr("2026-09-22T12:03:00Z", now)).toBe("à l'instant");
  });

  it("écrit les durées plus longues en français", () => {
    expect(formatRelativeFr("2026-09-22T11:55:00Z", now)).toBe("il y a 5 minutes");
    expect(formatRelativeFr("2026-09-22T09:00:00Z", now)).toBe("il y a 3 heures");
    expect(formatRelativeFr("2026-09-20T12:00:00Z", now)).toBe("il y a 2 jours");
  });

  it("refuse un instant illisible", () => {
    expect(() => formatRelativeFr("pas une date", now)).toThrow(/Instant invalide/);
  });
});

describe("times", () => {
  it("parses HH:MM and the HH:MM:SS Postgres returns", () => {
    expect(parseTimeToMinutes("09:30")).toBe(570);
    expect(parseTimeToMinutes("09:30:00")).toBe(570);
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
  });

  it("rejects malformed or impossible times", () => {
    expect(() => parseTimeToMinutes("9h30")).toThrow(/Format attendu/);
    expect(() => parseTimeToMinutes("24:00")).toThrow(/inexistante/);
    expect(() => parseTimeToMinutes("09:60")).toThrow(/inexistante/);
  });

  it("renders minutes back to a wall clock", () => {
    expect(minutesToTimeString(570)).toBe("09:30");
    expect(minutesToTimeString(0)).toBe("00:00");
    expect(() => minutesToTimeString(-1)).toThrow(/Durée invalide/);
    expect(() => minutesToTimeString(1.5)).toThrow(/Durée invalide/);
  });

  it("normalises a time for display", () => {
    expect(formatTime("09:30:00")).toBe("09:30");
    expect(formatTime("9:05")).toBe("09:05");
  });
});

describe("durations", () => {
  it("formats durations the way a French payslip reads", () => {
    expect(formatDuration(450)).toBe("7 h 30");
    expect(formatDuration(420)).toBe("7 h");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(0)).toBe("0 h");
    expect(formatDuration(65)).toBe("1 h 05");
  });

  it("keeps the sign on a negative balance", () => {
    expect(formatDuration(-75)).toBe("-1 h 15");
    expect(formatDuration(-30)).toBe("-30 min");
  });

  it("marks credits explicitly", () => {
    expect(formatSignedDuration(225)).toBe("+3 h 45");
    expect(formatSignedDuration(-75)).toBe("-1 h 15");
    expect(formatSignedDuration(0)).toBe("0 h");
  });

  it("refuses a non-finite duration", () => {
    expect(() => formatDuration(Number.NaN)).toThrow(/Durée invalide/);
  });
});

describe("workedMinutes", () => {
  it("computes the standard Oummi day: 09:00–17:30 minus a 1 h 30 lunch", () => {
    expect(
      workedMinutes({ start: "09:00", end: "17:30", breakStart: "12:30", breakEnd: "14:00" }),
    ).toBe(420);
  });

  it("computes the Saint-Denis day: 09:30–18:00 minus the same lunch", () => {
    expect(
      workedMinutes({ start: "09:30", end: "18:00", breakStart: "12:30", breakEnd: "14:00" }),
    ).toBe(420);
  });

  it("counts the whole shift when no break is recorded", () => {
    expect(workedMinutes({ start: "09:00", end: "17:30" })).toBe(510);
    expect(workedMinutes({ start: "09:00", end: "17:30", breakStart: null, breakEnd: null })).toBe(
      510,
    );
  });

  it("ignores a break that falls outside the shift", () => {
    expect(
      workedMinutes({ start: "14:30", end: "18:00", breakStart: "12:30", breakEnd: "14:00" }),
    ).toBe(210);
  });

  it("deducts only the overlapping part of a break", () => {
    // Shift starts at 13:00, break runs 12:30–14:00: only 13:00–14:00 counts.
    expect(
      workedMinutes({ start: "13:00", end: "18:00", breakStart: "12:30", breakEnd: "14:00" }),
    ).toBe(240);
  });

  it("refuses a shift that ends before it starts", () => {
    expect(() => workedMinutes({ start: "17:30", end: "09:00" })).toThrow(/Horaires invalides/);
    expect(() => workedMinutes({ start: "09:00", end: "09:00" })).toThrow(/Horaires invalides/);
  });

  it("refuses a break that ends before it starts", () => {
    expect(() =>
      workedMinutes({ start: "09:00", end: "17:30", breakStart: "14:00", breakEnd: "12:30" }),
    ).toThrow(/Pause invalide/);
  });
});
