/**
 * PIN rules.
 *
 * This list is mirrored in SQL by `public.is_acceptable_pin`, so a PIN typed by
 * the direction is checked again by the database and cannot slip through a bug in
 * the browser. `pin-parity.test.ts` fails if the two lists ever drift apart.
 */
export const TRIVIAL_PINS: ReadonlySet<string> = new Set([
  // Same digit four times.
  "0000",
  "1111",
  "2222",
  "3333",
  "4444",
  "5555",
  "6666",
  "7777",
  "8888",
  "9999",
  // Ascending runs.
  "1234",
  "2345",
  "3456",
  "4567",
  "5678",
  "6789",
  "0123",
  // Descending runs.
  "9876",
  "8765",
  "7654",
  "6543",
  "5432",
  "4321",
  "3210",
  // Repeated pairs, easy to read over a shoulder.
  "1122",
  "2211",
  "1212",
  "2121",
  "1010",
  "0101",
]);

export const PIN_LENGTH = 4;

const PIN_PATTERN = /^[0-9]{4}$/;

/** Four digits, and not one of the codes anyone would guess first. */
export function isAcceptablePin(pin: string): boolean {
  return PIN_PATTERN.test(pin) && !TRIVIAL_PINS.has(pin);
}

/** Right shape, but says nothing about how guessable it is. */
export function hasPinShape(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

/**
 * Draws a uniformly random integer in `[0, maxExclusive)`.
 * Injected so tests are deterministic; production passes `crypto.randomInt`.
 */
export type RandomInt = (maxExclusive: number) => number;

/**
 * A random acceptable PIN.
 *
 * Draws again on a trivial result rather than mapping it to another value, which
 * would make some codes likelier than others. With 30 codes excluded out of
 * 10 000, a redraw is needed roughly three times in a thousand.
 */
export function generatePin(randomInt: RandomInt): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = String(randomInt(10_000)).padStart(PIN_LENGTH, "0");
    if (isAcceptablePin(candidate)) return candidate;
  }
  // Only reachable with a broken generator, never with a real random source.
  throw new Error("Impossible de générer un code PIN : le tirage aléatoire ne varie pas.");
}
