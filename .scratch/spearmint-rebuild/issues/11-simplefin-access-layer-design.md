Type: task
Status: resolved
Blocked by: 10

## Question

Design the Angular access-layer service that absorbs SimpleFIN's quirks: setup-token claim UX (where/how the user pastes it in-app), access-URL storage (in RxDB, alongside everything else), sync scheduling that respects the 90-day-window-per-request and ~24-requests-per-day limits, and error handling (expired/revoked access, rate-limited, unreachable). Also defines how an ingest run maps SimpleFIN's account/transaction shape onto this app's Account/Institution/Transaction models, including running new transactions through the (redesigned) auto-categorization rules on import — mirroring what old Spearmint's `effects.ts` did for Plaid transactions.

**Added requirement (from [SimpleFIN CORS & protocol research](10-simplefin-cors-protocol-research.md)'s `con.auth` finding):** auth failures are per-connection, not per-access-URL — `errlist` entries carry a `conn_id` scoped to the one bank connection that needs re-auth. The design must sync every other account normally on each run and only flag the specific account(s) tied to the failing `conn_id` with a "needs reconnect" icon/badge; a single account needing re-auth at SimpleFIN Bridge must never block or degrade sync for the rest, nor force the user to reconnect accounts that are fine.

## Answer

*(This ticket was independently resolved by a concurrent session while this session was still grilling the same question with Brent. The two answers diverged — this is the reconciled version: Brent's live-session decisions kept as-is, with the concurrent session's account-remap and new-account-discovery scheme folded in as compatible additional detail.)*

**Claim UX**: Settings → Accounts → "Connect a bank" screen — a text field for pasting the SimpleFIN setup token, a "Connect" button that claims it (exchanging for an access URL), and an inline link out to the user's SimpleFIN Bridge provider for users who don't have a token yet (no embeddable widget like Plaid Link). This screen is reused for adding further connections later, not a one-time onboarding-only flow.

**Access-URL storage**: plaintext in RxDB, consistent with the rest of the app's data — protected only by the existing WebAuthn/passkey local-auth gate, not by field-level encryption. The export/import "optional encryption" toggle ([Backup & sync scope](05-backup-sync-scope.md)) is what protects it once data leaves the device.

**Sync scheduling**: auto-sync on the first app-open of each calendar day (SimpleFIN's own upstream data only refreshes once a day, so more frequent auto-sync buys nothing), gated by a stored `lastSyncDate` that's updated **only on a successful sync** — a failed auto-sync-on-open leaves the gate open, so closing and reopening the app retries. A manual "Sync now" action in Settings → Accounts is available anytime and also updates `lastSyncDate` on success. Each sync issues one `GET /accounts` covering every connection (quota-efficient — well under the ~24/day cap either way). Fetch window is `[lastSyncDate − 7 days, today]` (the 7-day overlap catches late-posting transactions; harmless since posted-transaction ingest is idempotent by id). If that span exceeds the 90-day-per-request cap (e.g. the app hasn't been opened in a long time), walk backward from today in ≤45-day chunks, up to 5 requests in one sync, stopping once the walked-back range reaches `lastSyncDate − 7 days`; if 5×45=225 days still doesn't cover the full gap, the oldest slice is left uncovered rather than issuing a 6th request.

**Account identity & remap**: each Account gets its own internal stable id (not SimpleFIN's), plus a stored `externalAccountId` (SimpleFIN's, which can change), `connId` (flat field directly on Account — no separate Connection entity), and the account's `originalInstitutionName`/`originalAccountName` captured at link time. If a previously-tracked account's `externalAccountId` is missing from a sync response, the access layer looks for an unrecognized account id **within the same `connId`** whose name matches the stored original account name; on a match it remaps `externalAccountId` in place (transaction history stays attached to the same internal Account id). If no unambiguous match is found, the account is flagged "Missing — can't reconnect automatically" and kept read-only with its history intact; no auto-removal.

**New-account discovery**: any account id in a sync response that's neither a tracked account, a remap target, nor previously ignored triggers a "New account found" badge with an "Add" action. An "Ignore" action records the external account id in a permanent per-connection ignore list (visible/clearable in Settings) so it never resurfaces on its own.

**Connection/error modeling**: no separate Connection entity — `connId` lives directly on Account alongside the institution reference. Whether Institution becomes a first-class entity (keyed by `orgId`) or stays denormalized fields on Account is explicitly left to [domain model reconciliation](16-domain-model-reconciliation.md); this ticket only establishes that `orgId`/`orgName` must be available per account from the access layer regardless of the final shape. Each connection is processed independently within a sync run — one connection's failure never blocks another's.

**Error taxonomy**:
| Condition | Scope | Behavior |
|---|---|---|
| `con.auth` | that account | Flagged `needsReconnect` independently per account (not shared via a Connection entity, so the user can act on one flagged account without being forced to reconnect unaffected siblings under the same connection); links out to SimpleFIN Bridge's hosted reauth page |
| other `con.*`/`act.*` errors | that account | "Sync issue" badge showing the server's `msg` verbatim |
| Missing account, no remap match | that account | "Missing — can't reconnect automatically" badge (see Account identity & remap) |
| New unrecognized account id | that account | "New account found" badge with Add/Ignore |
| Rate-limited / quota near-exhausted | whole sync run | Sync marked failed, surfaced via the "errors" trigger from [Notifications scope](08-notifications-scope.md), no auto-retry; `lastSyncDate` not updated if this was the auto-sync-on-open, so the next app-open retries |
| Unreachable (no response) | whole sync run | Same as rate-limited |

**Posted transactions**: upserted by SimpleFIN's transaction `id`. A new id is mapped to the domain Transaction model (`Transaction.date` = SimpleFIN's `posted`, not `transacted_at`; `amount` parsed from SimpleFIN's decimal string, sign convention already matches — positive = deposit) and run once through the auto-categorization heuristic ([Auto-categorization approach](12-auto-categorization-approach.md))'s three-tier auto-apply/suggest/no-match outcome, then persisted — same point in the flow old Spearmint's `effects.ts` ran categorization. An already-known id has only mutable fields (e.g. amount adjustments as it settles) updated — never re-categorized, so a user's manual correction is never clobbered.

**Pending transactions**: treated as fully transient, not permanent records. On every sync, per account, all currently-stored pending transactions for that account are deleted and replaced with whatever the fresh response contains; each is run through the categorization heuristic fresh every time. Locked from manual editing while pending (pointless to edit something that gets wiped next sync). When a pending transaction settles, it simply stops appearing as pending and shows up as an independent new posted transaction — own id, own categorization run — with no continuity assumed between the two records.

**Holdings**: ignored entirely for v1 — the access layer doesn't read the `holdings` field on brokerage-type accounts; their balance and any real transactions still sync normally.

