import { describe, expect, it } from "vitest";

import { generatePin, hasPinShape, isAcceptablePin, TRIVIAL_PINS } from "../domain/pin";

describe("isAcceptablePin", () => {
  it("accepts an ordinary four-digit code", () => {
    expect(isAcceptablePin("7392")).toBe(true);
    expect(isAcceptablePin("0472")).toBe(true);
    expect(isAcceptablePin("9018")).toBe(true);
  });

  it("rejects every code on the trivial list", () => {
    for (const pin of TRIVIAL_PINS) {
      expect(isAcceptablePin(pin), `${pin} devrait être refusé`).toBe(false);
    }
  });

  it("rejects anything that is not exactly four digits", () => {
    expect(isAcceptablePin("739")).toBe(false);
    expect(isAcceptablePin("73921")).toBe(false);
    expect(isAcceptablePin("73a2")).toBe(false);
    expect(isAcceptablePin("")).toBe(false);
    expect(isAcceptablePin(" 7392")).toBe(false);
    expect(isAcceptablePin("73 2")).toBe(false);
  });

  it("separates shape from guessability", () => {
    expect(hasPinShape("1234")).toBe(true);
    expect(isAcceptablePin("1234")).toBe(false);
  });
});

describe("generatePin", () => {
  it("pads a small draw to four digits", () => {
    expect(generatePin(() => 7)).toBe("0007");
    expect(generatePin(() => 472)).toBe("0472");
  });

  it("draws again instead of remapping a trivial result", () => {
    const draws = [1234, 1111, 7392];
    let index = 0;
    // A remap would bias the outcome; a redraw keeps every code equally likely.
    expect(generatePin(() => draws[index++] ?? 0)).toBe("7392");
    expect(index).toBe(3);
  });

  it("gives up rather than loop forever on a broken generator", () => {
    expect(() => generatePin(() => 1234)).toThrow(/ne varie pas/);
  });

  it("only ever produces acceptable codes", () => {
    let seed = 12345;
    const pseudoRandom = (max: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % max;
    };
    for (let i = 0; i < 2000; i += 1) {
      const pin = generatePin(pseudoRandom);
      expect(isAcceptablePin(pin), `${pin} ne devrait pas être produit`).toBe(true);
    }
  });
});
