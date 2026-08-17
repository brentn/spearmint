/**
 * Single shared password-length policy for every password *created* in the app
 * (backup export encryption, app-unlock). Deliberately has no dependency on
 * crypto-js so it's safe to import from eagerly-loaded code (e.g. the auth
 * gate) without dragging that ~600kB dependency into the main bundle — unlike
 * RxDB's own `MINIMUM_PASSWORD_LENGTH` (rxdb/plugins/encryption-crypto-js),
 * which this replaces everywhere a password is *set*.
 *
 * Does not apply to entering a password to *decrypt* an existing backup —
 * that must keep accepting shorter passwords from before this policy existed.
 */
export const MIN_PASSWORD_LENGTH = 12;

export const PASSWORD_LENGTH_HINT = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
