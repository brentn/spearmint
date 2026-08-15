# Spearmint

A personal, single-user, mobile-first budgeting app styled after the old mint.com mobile app. Local-first: no backend server, data lives in the browser via RxDB/IndexedDB, bank data comes from SimpleFIN.

## Language

**Institution**:
A bank or financial provider an `Account` belongs to, normalized and keyed by SimpleFIN's `org_id`.
_Avoid_: Bank, provider

**Account**:
A single bank or credit-card account linked via SimpleFIN, holding a user-set `AccountType` (`bank` | `creditCard`) that has no SimpleFIN equivalent.
_Avoid_: Connection (see SimplefinLink)

**SimplefinLink**:
The stored SimpleFIN access URL and connection state for a set of accounts, referenced from `Account` via a flat `connId` rather than a dedicated relational entity.
_Avoid_: Connection — considered and rejected; connection membership is a flat field on `Account`, not its own entity.

**Category**:
A budgeting bucket transactions and budgets attach to, two levels deep (parent/child), typed as `CategoryType`: `expense`, `income`, or `transfer`. Income is a first-class category type, not a sign convention on expense categories.
_Avoid_: Tag, label

**Transaction**:
A posted or pending movement of money on an `Account`, sourced exclusively from SimpleFIN sync — there is no manual-entry path.
_Avoid_: Entry, record

**Budget**:
A user-set spending target for a `Category` over a period (`month` or `year`), optionally carrying a `Rollover` from the prior period.
_Avoid_: Limit, allowance

**Implied Budget**:
A synthesized (non-persisted) budget row for a parent `Category` that has no explicit `Budget` of its own but at least one budgeted descendant — its amount/rollover/spent are the recursive combination of its budgeted descendants'. Flagged `implied: true` so the UI can distinguish it from a real, user-created `Budget`.
_Avoid_: Virtual budget, computed budget

**Rollover**:
The unspent portion of a `Budget` carried forward into the next period, added to that period's available amount. Income categories are excluded from rollover entirely — they compare target vs. actual only.
_Avoid_: Carryover, surplus

**CategorizationRule**:
A stored fingerprint — `(accountId, normalizedDescription)` plus amount/day-of-month — used to auto-categorize future transactions from a past user correction.
_Avoid_: Transformation (the broader, now-abandoned predecessor concept from old Spearmint that also handled merchant renaming and budget-exclusion memory)
