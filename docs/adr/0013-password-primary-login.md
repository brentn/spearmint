# Password-primary login, WebAuthn as an optional 2nd step

Login is password-first: a password (12-character minimum, shared policy module) is created on first run and is the sole credential required to unlock. This supersedes ADR-0003's WebAuthn-only design — a lost/dead security key with no password fallback was a full lockout with no recovery path short of wiping local data.

WebAuthn (`@passwordless-id/webauthn`, still fully local — see ADR-0003) is kept only as an optional, faster 2nd step (`AppSettings.biometricsEnabled`), toggled in Settings → Security. Anyone upgrading from a WebAuthn-only install keeps their credential as that 2nd step automatically (schema migration sets `biometricsEnabled` from the presence of a stored credential) and is required to set a password on their next unlock before the app is usable.

The app also auto-locks after 5 minutes of continuous inactivity (idle or backgrounded, one shared clock — not an instant lock on backgrounding), and offers a "reset this device" escape hatch from the lock screen for the case where both the password is forgotten and the security key is gone. Resetting wipes local data with no login required — an accepted tradeoff of offering recovery without a login, per issue #25/#35.
