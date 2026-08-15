/**
 * Noise-label prefixes that precede a reference/date fragment old Spearmint stripped by exact
 * substring (`transformation.ts:19-22`: "Cheque Date", "Confirmation #", "Reference Number").
 * Generalized here to a configurable list rather than hardcoded literals (spec §3.1) — anything
 * from the first matching label onward is dropped, mirroring the old `.split(label)[0]` behavior.
 */
const NOISE_LABEL_PREFIXES = [
  'CHEQUE DATE',
  'CONFIRMATION #',
  'CONFIRMATION NUMBER',
  'REFERENCE NUMBER',
  'REFERENCE #',
  'TRACE NUMBER',
  'AUTH CODE',
  'AUTHORIZATION CODE',
];

const DOLLAR_AMOUNT_PATTERN = /\$\s?\d[\d,]*(\.\d+)?/g;
const DATE_FRAGMENT_PATTERN = /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b|\b\d{4}-\d{1,2}-\d{1,2}\b/g;
const NON_ALPHANUMERIC_PATTERN = /[^A-Z0-9\s]/g;
const MAX_LENGTH = 40;

/** A token mixing letters and digits, 6+ characters — typical of a POS terminal/reference code. */
function isLongReferenceToken(token: string): boolean {
  return token.length >= 6 && /[A-Z]/.test(token) && /\d/.test(token);
}

/**
 * Normalizes a raw SimpleFIN `description` into the string CategorizationRule matching compares
 * against — applied identically when storing a correction and when scoring an incoming
 * transaction (spec §3.1). Order: case-fold → strip noise-label prefixes → strip $-amount and
 * date fragments → strip long mixed-alphanumeric reference tokens → collapse whitespace → cap
 * at 40 chars (a safety cap, not the primary noise-removal mechanism).
 */
export function normalizeDescription(raw: string): string {
  let value = raw.toUpperCase();

  let cutoff = value.length;
  for (const prefix of NOISE_LABEL_PREFIXES) {
    const index = value.indexOf(prefix);
    if (index !== -1 && index < cutoff) {
      cutoff = index;
    }
  }
  value = value.slice(0, cutoff);

  value = value.replace(DOLLAR_AMOUNT_PATTERN, ' ');
  value = value.replace(DATE_FRAGMENT_PATTERN, ' ');
  value = value.replace(NON_ALPHANUMERIC_PATTERN, ' ');

  value = value
    .split(/\s+/)
    .filter((token) => token.length > 0 && !isLongReferenceToken(token))
    .join(' ');

  return value.trim().slice(0, MAX_LENGTH).trim();
}
