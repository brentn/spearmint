# Local-only WebAuthn auth

> Superseded in part by ADR-0013: login is now password-primary, with WebAuthn kept as an
> optional 2nd step rather than the sole credential. The local-only, no-server-round-trip
> mechanics described below are unchanged.

Authentication is fully client-side WebAuthn using the platform authenticator (e.g. FaceID on iPhone) — registration and verification both run in-browser via `@passwordless-id/webauthn`, with no server round trip. The only persisted state is the credential itself; losing it locks the user out, recoverable only by restoring an export/import backup, not by any account-recovery flow.
