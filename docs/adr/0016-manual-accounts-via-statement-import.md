# Manual accounts via statement import — a scoped bridge for unsupported banks

> Supersedes in part ADR-0011: `Transaction` is no longer SimpleFIN-only. A narrow,
> deliberate exception exists for Manual Accounts, described below — this is not a
> general manual-entry feature.

A Manual Account exists as a stopgap for one specific bank SimpleFIN doesn't yet support, not as a standing "add any manual account" feature. Its transactions and balance come from a Statement Import — the user uploads an OFX, QFX, or QBO file exported from the bank's own portal — rather than a one-by-one entry form.

OFX was chosen over CSV or a per-bank PDF-statement parser because it's a genuine cross-institution standard: QFX and QBO are the same `<STMTTRN>` transaction format under Quicken/QuickBooks branding, so one parser covers all three file extensions with no per-bank customization. CSV and PDF both would have needed a bank-specific layout/column mapping — CSV has no standard column order, and PDF has no standard layout at all — for a feature that's explicitly a stopgap, not something worth building a per-bank adapter system for. Imported transactions upsert by the file's `FITID`, so re-importing an overlapping statement period is idempotent rather than duplicating rows; the account's balance updates from the file's ledger balance, so there's no separate manual-balance UI.

When SimpleFIN adds support for the bank, the Manual Account is deleted outright (see ADR-0017) and a fresh SimpleFIN-linked `Account` is created in its place — there is no linking of the manual account to the new one, no reconciliation of overlapping transaction history, and no carryover of the `CategorizationRule`s accumulated against the manual account's id. This is an accepted, deliberate loss: reconciling a manually-imported transaction set (keyed by file `FITID`) against a freshly-synced one (keyed by SimpleFIN's own ids) has no natural shared key, and building that dedup logic was judged not worth it for a temporary bridge.
