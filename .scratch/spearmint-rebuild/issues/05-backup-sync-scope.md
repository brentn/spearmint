Type: grilling
Status: resolved

## Question

Fully local auth + fully local data (RxDB) means everything lives on one device/browser. Two related questions: (1) is there a deliberate backup/recovery path for local-only WebAuthn, given storage-clear or device loss means lockout plus data loss? (2) is this app single-device by design, or does it need to work across multiple devices (phone + desktop), which would change what "backup" needs to do?

## Answer

**Single-device by design.** No real-time or automatic multi-device sync.

**Export/import is the only backup and the only sync mechanism** — a full export of the local dataset (RxDB contents including the WebAuthn credential) that can be re-imported to recover from storage loss, or manually carried to a second device. Export has a **switch to encrypt or not** — an unencrypted export is simpler to inspect/debug, an encrypted one is safer to store off-device (e.g. cloud drive, email to self).
