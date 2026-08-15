# Local-only WebAuthn auth

Authentication is fully client-side WebAuthn using the platform authenticator (e.g. FaceID on iPhone) — registration and verification both run in-browser via `@passwordless-id/webauthn`, with no server round trip. The only persisted state is the credential itself; losing it locks the user out, recoverable only by restoring an export/import backup, not by any account-recovery flow.
