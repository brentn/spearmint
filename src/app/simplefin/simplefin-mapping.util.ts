import type { DateOnly } from '../data/models';

/**
 * SimpleFIN amounts are decimal strings, not floats (10-research-notes.md). Parsing via
 * Number() and rounding to the cent avoids the schema's `multipleOf: 0.01` rejecting a
 * value like 65.499999999999 that binary floating point can produce from "65.50".
 */
export function parseDecimalAmount(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Not a valid decimal amount: "${value}"`);
  }
  return Math.round(parsed * 100) / 100;
}

/** SimpleFIN dates are Unix-epoch seconds; always derived from `posted`, never `transacted_at`. */
export function epochSecondsToDateOnly(epochSeconds: number): DateOnly {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}
