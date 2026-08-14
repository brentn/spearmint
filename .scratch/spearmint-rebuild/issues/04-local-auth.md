Type: grilling
Status: resolved

## Question

With no backend at all, the old app's only other server-side job (WebAuthn challenge issuance + credential storage in Postgres) also goes away. Does auth become fully local — register/store the credential client-side and verify signatures with no server round trip — and can it take advantage of platform biometrics (FaceID on iPhone)?

## Answer

**Fully local auth**, completing the "authenticate locally" work already underway in this repo's recent commits (see `src/app/auth/auth.service.ts`, `authenticateUserLocally$`). No server round trip for register or authenticate.

**Use the platform authenticator** — request `authenticatorAttachment: 'platform'` and `userVerification: 'required'` in the WebAuthn options, so iOS surfaces FaceID/TouchID directly for verification.

Losing the local credential (storage cleared, device lost) means lockout — addressed by [Backup & sync scope](05-backup-sync-scope.md) (export/import), not by any server-side recovery.
