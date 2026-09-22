import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { TRIVIAL_PINS } from "../domain/pin";

/**
 * The browser and the database each refuse trivial PINs. If the two lists drift,
 * one of the checks becomes a lie. This test reads the migration and compares.
 */
describe("parité entre la liste TypeScript et la liste SQL", () => {
  it("interdit exactement les mêmes codes des deux côtés", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20260922120000_employees_auth.sql"),
      "utf8",
    );

    const functionBody = migration.split("create or replace function public.is_acceptable_pin")[1];
    expect(functionBody, "fonction is_acceptable_pin introuvable").toBeDefined();

    const notInClause = functionBody?.split("not in (")[1]?.split(");")[0] ?? "";
    const sqlPins = [...notInClause.matchAll(/'(\d{4})'/g)].map((match) => match[1] ?? "");

    expect(sqlPins.length, "aucun code lu dans la migration").toBeGreaterThan(0);
    expect(new Set(sqlPins)).toEqual(TRIVIAL_PINS);
  });
});
