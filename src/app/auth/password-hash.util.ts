import type { PasswordHash } from '../data/models';

// Fixed, in-code — never persisted per-password, so raising this later re-hashes
// nothing retroactively; it only changes the cost of hashes created from then on.
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...array));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function deriveBits(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
  return toBase64(bits);
}

/** Salts and hashes `password` with PBKDF2-SHA256, ready to store as `AppSettings.passwordHash`. */
export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBits(password, salt);
  return { salt: toBase64(salt), hash };
}

/** Re-derives a hash for `password` using `stored`'s salt and compares it to `stored.hash`. */
export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  const hash = await deriveBits(password, fromBase64(stored.salt));
  return hash === stored.hash;
}
