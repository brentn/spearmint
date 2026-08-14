Type: task
Status: resolved
Blocked by: 11, 12, 13

## Question

Write the final domain model, reconciling Spearmint's and Peppermint's shapes with everything decided on this map: Account, Institution (normalized out per Peppermint's pattern, mapping onto SimpleFIN's org-per-account concept), Transaction (SimpleFIN-sourced fields per [#10](10-simplefin-cors-protocol-research.md)/[#11](11-simplefin-access-layer-design.md)), Category (parent/child per [#07](07-category-taxonomy-approach.md)/[#13](13-default-category-list.md)), Budget (rollover fields, see [#17](17-rollover-engine-generalization.md)), and the redesigned auto-categorization rule (per [#12](12-auto-categorization-approach.md)).

## Answer

Reuses Peppermint's `date-types.model.ts` primitives as-is: `DateOnly = string` (YYYY-MM-DD), `UtcTimestamp = string` (ISO), `PeriodType = 'month' | 'year'`, `YearMonth = string`.

### Institution

**Decision: normalized out as its own entity** (per Peppermint's `Account.institutionId` → `Institution` pattern), keyed directly by SimpleFIN's `org_id` — no separate internal id needed since `org_id` is already stable per the protocol (confirmed in [#10](10-simplefin-cors-protocol-research.md)'s response-shape reference). This is orthogonal to [#11](11-simplefin-access-layer-design.md)'s "no separate Connection entity" call: `connId` (auth/sync boundary) stays flat on `Account` as that ticket decided; `Institution` (display identity — name, link-out URL) is a different concept and normalizing it just avoids repeating `org_name`/`org_url` on every account row under the same bank.

```ts
export interface Institution {
  id: string;        // = SimpleFIN's org_id
  name: string;       // org_name
  url: string | null; // org_url, for a "log in at your bank" link-out
}
```

### Account

**Decision: keep a lightweight, user-assigned `AccountType`.** SimpleFIN's `/accounts` response (per [#10](10-simplefin-cors-protocol-research.md)) has no account-type field at all — just `id`, `name`, `currency`, `balance`, `available-balance`, `balance-date`, `conn_id`. Old Spearmint's own `AccountType` (`src/app/data/types/accountType.ts`) was already just `'bank' | 'creditCard'`, not a rich Plaid-style taxonomy — carried forward unchanged, since the Overview tab needs *some* asset-vs-liability signal to total balances correctly (a credit card balance is debt, not cash). SimpleFIN can't supply it, so it's user-set at connect time (default `'bank'`), editable after.

```ts
export type AccountType = 'bank' | 'creditCard';

export interface Account {
  id: string;                  // internal, stable, generated at link time — never SimpleFIN's account id directly
  institutionId: string;        // FK -> Institution.id
  connId: string;                // SimpleFIN conn_id, flat per #11 (no Connection entity)
  externalAccountId: string;     // SimpleFIN's current account id; remappable in place if it changes (#11)
  originalAccountName: string;   // captured at link time; used for name-match remapping (#11)
  name: string;                   // user-editable display name, seeded from SimpleFIN's name at link time
  type: AccountType;
  currencyCode: string;            // free string (e.g. "USD"), not old Spearmint's closed CAD|USD union — SimpleFIN can report any ISO currency
  balance: number;                  // parsed from SimpleFIN's decimal string
  balanceDate: DateOnly;             // from SimpleFIN's balance-date (epoch seconds -> UTC calendar date)
  needsReconnect: boolean;           // con.auth error scoped to this account (#11)
  syncIssue: string | null;          // verbatim msg from a non-auth con.*/act.* error (#11); null when fine
  missing: boolean;                   // externalAccountId absent from a sync response with no remap match (#11); kept read-only, history intact
}
```

Newly-discovered accounts (SimpleFIN ids not yet tracked, remapped, or ignored) are **not** modeled as `Account` rows in any state — per [#11](11-simplefin-access-layer-design.md) they're a transient sync-result computation ("ids in the response minus tracked minus ignored"), surfaced as the "New account found" badge, only becoming an `Account` row on explicit Add. The parallel per-connection ignore list is likewise not an entity — it's `AppSettings.ignoredExternalAccounts` (below), since it's just a small permanent exclusion set with no lifecycle of its own.

### Category

**Decision: extend `CategoryType` to a third value, `'transfer'`**, resolving the open question carried from [#13](13-default-category-list.md). Peppermint's `CategoryType` is `'expense' | 'income'` only; overloading `'expense'` with an implicit "actually don't count this" exception would leak into every budget/reporting consumer. An explicit third type is self-documenting and Peppermint's existing `validateCategory` (parent/child type match, cycle detection, sibling dup-name, delete-blocked-if-has-children — all reused unchanged) already type-checks on this field, so it's a one-line extension, not new logic. `Budget.categoryId` is left open to any type — nothing stops a user from budgeting a `'transfer'` category like "Credit Card Payment" if they want to track planned transfers; the UI, not the schema, decides which types are shown on the default spend views.

```ts
export type CategoryType = 'expense' | 'income' | 'transfer';

export interface Category {
  id: string;
  name: string;
  parentCategoryId: string | null;
  type: CategoryType;
}
```

### Transaction

Field names deliberately mirror SimpleFIN's own vocabulary (`pending`) rather than inventing new terms, since the access layer is the only writer and less translation at that boundary means fewer bugs — including the class of bug `git log` shows this repo already paid for once ("Fix timezone error"). `date` is always derived from SimpleFIN's `posted` field (never `transacted_at`, per [#11](11-simplefin-access-layer-design.md)) as a UTC calendar date — no local-timezone arithmetic, which is what caused the prior bug.

```ts
export interface Transaction {
  id: string;                  // SimpleFIN's transaction id, used directly — posted transactions are upserted by this id (#11)
  accountId: string;            // FK -> Account.id (internal id, not externalAccountId)
  date: DateOnly;                 // UTC calendar date from SimpleFIN's `posted` (epoch seconds), never `transacted_at`
  description: string;             // raw, as SimpleFIN sends it — the only merchant-text field it provides (no payee/memo/merchantId to lean on, per #12's research)
  amount: number;                   // parsed from SimpleFIN's decimal string; positive = deposit
  pending: boolean;                  // pending rows are fully transient — wiped/reinstated and re-categorized every sync, locked from editing (#11)
  categoryId: string | null;          // null = auto-categorization's "no-match" tier (#12), left for manual categorization
  excludeFromBudget: boolean;          // carried forward from old Spearmint's `hideFromBudget`; user-settable, defaults false
  notes: string | null;                 // carried forward from old Spearmint
}
```

Dropped from old Spearmint's shape entirely, with no replacement: `merchantId`, `paymentChannel` — both Plaid-specific fields SimpleFIN has no equivalent for, and nothing else on the map depends on them. No `currencyCode` per transaction (inherits from `Account.currencyCode`; SimpleFIN doesn't report differing currency per transaction). No manual (non-SimpleFIN) transaction entry — nothing on this map asks for it, and none of the surveyed source repos have it; recorded as a new line in the map's **Out of scope**, not left ambiguous.

### Budget

**No schema changes for the [rollover engine generalization](17-rollover-engine-generalization.md).** Peppermint's shape is carried forward unchanged — the parent-rolls-up-children behavior #17 defines is a change to `recomputeRolloversInMemory`'s *computation* (summing children's actual spend into a parent's rollover math), not a new stored field. This unblocks #17 on the finalized `Category` parent/child shape above without pre-guessing its formula.

```ts
export interface Budget {
  id: string;
  categoryId: string;
  periodType: PeriodType;
  period: YearMonth;
  rollOver: boolean;
  rolloverAmount?: number;
  amount: number;
}
```

### CategorizationRule (successor to old Spearmint's `Transformation`)

Scope is deliberately narrower than the old `Transformation`: [#12](12-auto-categorization-approach.md)'s research and answer only ever talk about correcting `categoryId` via the four-signal score (name/amount/account/recurrence). Old `Transformation`'s `newMerchant` (rename-on-match) and `newHideFromBudget` (exclusion-memory) are **not** carried forward — dropping them is a scope call made here, not an oversight, since nothing on this map asks for merchant-rename memory or exclusion memory and re-adding them would be scope creep on a ticket about matching, not correction breadth.

```ts
export interface CategorizationRule {
  id: string;
  accountId: string;              // candidacy gate (#12)
  normalizedDescription: string;   // snapshot of the description run through #12's normalization pipeline at creation time
  amount: number;                   // reference amount for the 5%-proximity signal (#12)
  dayOfMonth: number;                // 1-31, for the recurrence-proximity signal (#12)
  categoryId: string;                 // the corrected/target category
  createdAtUtc: UtcTimestamp;
  updatedAtUtc: UtcTimestamp;
}
```

**Left to the implementation effort, not decided here:** the upsert/dedup policy when a user corrects a transaction shape that already has a matching rule (old `Transformation` deduped via prefix-extension on accountId+merchantId+categoryId — that mechanism doesn't carry over cleanly since there's no `merchantId` anymore). This is write-path mechanics, not a domain-shape question, consistent with the map's Notes already keeping implementation sequencing off the map itself.

### AppSettings

Small carrier for the cross-ticket app-level state already implied elsewhere on this map — not itself a design decision, just collecting what's already been decided so it's not lost:

```ts
export interface AppSettings {
  lastSyncDate: DateOnly | null;         // gates auto-sync; advances only on a successful sync (#11)
  webauthnCredentialId: string | null;    // local passkey credential (#04)
  ignoredExternalAccounts: string[];       // `${connId}:${externalAccountId}` composite keys — the permanent per-connection ignore list (#11)
  exportEncryptionDefault: boolean;         // remembers the user's last choice on the export toggle (#05); not the encryption key itself
}
```
