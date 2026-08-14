# Spearmint Rebuild — Consolidated Spec

Status: **Locked**. This document assembles every decision made on the [Spearmint Rebuild map](../map.md) into a single handoff artifact for a follow-up implementation effort. It is a spec/architecture document, not a deployed app — nothing here has been built except the four clickable UI prototypes linked in §8.

## 0. Destination & framing

A from-scratch rebuild of Spearmint: a personal, single-user, mobile-first budgeting app styled after the old mint.com mobile app, built on SimpleFIN instead of Plaid. **No backend service** — a single static frontend, local-first, single-device, synced only via manual export/import.

Two existing codebases were mined for what to carry forward:

- **Spearmint** (this repo, Angular 16) — Plaid banking (replaced by SimpleFIN), WebAuthn passkey auth (mid-pivot to fully local, completed here), RxDB/IndexedDB persistence (kept), a flat Plaid-taxonomy category list (replaced), a "Transformation" auto-categorization-memory feature (kept, upgraded).
- **Peppermint** (sibling repo, Angular 21 standalone+Signals) — a working rollover-budget engine and real category parent/child hierarchy (both ported/generalized), a service→store→component layering convention (adopted), a Gmail-notification-parsing ingest pipeline (**not** carried forward — SimpleFIN replaces it there too, per that repo's own TODO.md).

**Stack**: Angular latest stable, standalone components, Signals, Bootstrap (mobile-first), Reactive Forms, RxDB over IndexedDB, FontAwesome icons. No backend, no NgRx (Peppermint's signal-store pattern replaces the entity-store role NgRx played in old Spearmint).

**Housekeeping note for implementation**: tag current `master` before deleting `src/API` and the old `src/app` tree, so history stays recoverable.

---

## 1. Domain model

Reuses Peppermint's `date-types.model.ts` primitives as-is: `DateOnly = string` (YYYY-MM-DD), `UtcTimestamp = string` (ISO), `PeriodType = 'month' | 'year'`, `YearMonth = string`.

### Institution

Normalized out as its own entity, keyed directly by SimpleFIN's `org_id` (stable per protocol — no separate internal id needed).

```ts
export interface Institution {
  id: string;        // = SimpleFIN's org_id
  name: string;       // org_name
  url: string | null; // org_url, for a "log in at your bank" link-out
}
```

### Account

```ts
export type AccountType = 'bank' | 'creditCard';

export interface Account {
  id: string;                  // internal, stable, generated at link time — never SimpleFIN's account id directly
  institutionId: string;        // FK -> Institution.id
  connId: string;                // SimpleFIN conn_id, flat (no Connection entity)
  externalAccountId: string;     // SimpleFIN's current account id; remappable in place if it changes
  originalAccountName: string;   // captured at link time; used for name-match remapping
  name: string;                   // user-editable display name, seeded from SimpleFIN's name at link time
  type: AccountType;               // user-set at connect time (default 'bank'); SimpleFIN has no equivalent field
  currencyCode: string;             // free string (e.g. "USD") — SimpleFIN can report any ISO currency
  balance: number;                   // parsed from SimpleFIN's decimal string
  balanceDate: DateOnly;               // from SimpleFIN's balance-date (epoch seconds -> UTC calendar date)
  needsReconnect: boolean;             // con.auth error scoped to this account
  syncIssue: string | null;             // verbatim msg from a non-auth con.*/act.* error; null when fine
  missing: boolean;                      // externalAccountId absent from a sync response, no remap match; read-only, history intact
}
```

Newly-discovered SimpleFIN accounts are **not** modeled as `Account` rows in any interim state — they're a transient sync-result computation, surfaced as a "New account found" badge, only becoming an `Account` row on explicit Add.

### Category

```ts
export type CategoryType = 'expense' | 'income' | 'transfer';

export interface Category {
  id: string;
  name: string;
  parentCategoryId: string | null;
  type: CategoryType;
}
```

Peppermint's `validateCategory` (cycle detection, sibling dup-name, delete-blocked-if-has-children, parent/child type match) is reused unchanged.

### Transaction

Field names deliberately mirror SimpleFIN's own vocabulary. `date` is always derived from SimpleFIN's `posted` (never `transacted_at`) as a UTC calendar date — this repo already paid for a timezone bug once ("Fix timezone error" in git history); no local-timezone arithmetic here.

```ts
export interface Transaction {
  id: string;                  // SimpleFIN's transaction id — posted transactions upserted by this id
  accountId: string;            // FK -> Account.id (internal id, not externalAccountId)
  date: DateOnly;                 // UTC calendar date from SimpleFIN's `posted` (epoch seconds)
  description: string;             // raw, as SimpleFIN sends it — the only merchant-text field it provides
  amount: number;                   // parsed from SimpleFIN's decimal string; positive = deposit
  pending: boolean;                  // pending rows are fully transient — wiped/reinstated + re-categorized every sync
  categoryId: string | null;          // null = auto-categorization's "no-match" tier
  excludeFromBudget: boolean;          // carried forward from old Spearmint's `hideFromBudget`; defaults false
  notes: string | null;                 // carried forward from old Spearmint
}
```

Dropped with no replacement: `merchantId`, `paymentChannel` (Plaid-specific, no SimpleFIN equivalent, nothing else depends on them). No per-transaction `currencyCode` (inherits from `Account.currencyCode`). No manual (non-SimpleFIN) transaction entry.

### Budget

No schema changes from Peppermint — the rollover-generalization work (§4) is a computation change, not a shape change.

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

Narrower than the old `Transformation` by design — category-matching only. `newMerchant` (rename-on-match) and `newHideFromBudget` (exclusion memory) are dropped; nothing on this map asks for them.

```ts
export interface CategorizationRule {
  id: string;
  accountId: string;              // candidacy gate
  normalizedDescription: string;   // snapshot of description run through the normalization pipeline (§3) at creation time
  amount: number;                   // reference amount for the 5%-proximity signal
  dayOfMonth: number;                // 1-31, for the recurrence-proximity signal
  categoryId: string;                 // the corrected/target category
  createdAtUtc: UtcTimestamp;
  updatedAtUtc: UtcTimestamp;
}
```

Left to the implementation effort: the upsert/dedup policy when a user corrects a transaction whose shape already matches an existing rule.

### AppSettings

```ts
export interface AppSettings {
  lastSyncDate: DateOnly | null;         // gates auto-sync; advances only on a successful sync
  webauthnCredentialId: string | null;    // local passkey credential
  ignoredExternalAccounts: string[];       // `${connId}:${externalAccountId}` composite keys — permanent per-connection ignore list
  exportEncryptionDefault: boolean;         // remembers the user's last choice on the export toggle
}
```

*(Full rationale: [Domain model reconciliation](../issues/16-domain-model-reconciliation.md))*

---

## 2. Persistence

**RxDB/IndexedDB, carried forward from Spearmint** — already proven in this codebase; IndexedDB is async and not meaningfully capped the way localStorage is; RxDB's reactive collections map naturally onto Angular Signals for the store layer.

**No migration path.** The existing Spearmint database is dropped completely; the new app starts fresh.

*(Detail: [Persistence layer](../issues/02-persistence-layer.md))*

---

## 3. SimpleFIN access layer

**No backend at all** — SimpleFIN is called directly from the frontend. Validated empirically: both the claim endpoint and `/accounts` return proper `Access-Control-Allow-Origin`/`-Credentials`/`-Headers` on success *and* error responses; an `Authorization`-header preflight to `/accounts` succeeds. Amounts are decimal strings, dates are Unix-epoch seconds, errors are structured `{code, msg, conn_id?, account_id?}`.

**Re-authentication has no API-level fix.** A `con.auth` error means the access layer must detect it and link the user out to SimpleFIN Bridge's own hosted page — third-party apps never handle bank MFA. This is a deliberate protocol boundary, not a gap to design around, and lines up with the "auth issues" notification trigger (§6).

### Claim UX

Settings → Accounts → "Connect a bank" screen: a text field for pasting the SimpleFIN setup token, a "Connect" button that claims it (exchanging for an access URL), and an inline link out to the user's SimpleFIN Bridge provider. Reused for adding further connections later, not one-time-only.

### Storage

Access-URL stored **plaintext in RxDB**, consistent with the rest of the app's data — protected only by the WebAuthn/passkey local-auth gate (§5), not field-level encryption. The export/import optional-encryption toggle (§5) is what protects it once data leaves the device.

### Sync scheduling

- Auto-sync on the first app-open of each calendar day, gated by `AppSettings.lastSyncDate`, which advances **only on a successful sync**. A failed auto-sync leaves the gate open so the next app-open retries.
- Manual "Sync now" in Settings → Accounts, available anytime, also advances `lastSyncDate` on success.
- One `GET /accounts` per sync covers every connection (well under SimpleFIN's ~24/day cap).
- Fetch window: `[lastSyncDate − 7 days, today]` (7-day overlap catches late-posting transactions; harmless since posted-transaction ingest is idempotent by id).
- If that span exceeds the 90-day-per-request cap, walk backward from today in ≤45-day chunks, up to 5 requests in one sync, stopping once the walked-back range reaches `lastSyncDate − 7 days`. If 5×45=225 days still doesn't cover the gap, the oldest slice is left uncovered rather than issuing a 6th request.

### Account identity, remap & discovery

- Each `Account` has its own internal id plus a stored `externalAccountId` (SimpleFIN's, which can change), `connId`, and `originalAccountName` captured at link time.
- If a tracked account's `externalAccountId` is missing from a sync response, look for an unrecognized account id **within the same `connId`** whose name matches the stored original name; remap `externalAccountId` in place on a match (transaction history stays attached). No unambiguous match → flagged `missing: true`, kept read-only, history intact, no auto-removal.
- Any account id in a response that's neither tracked, a remap target, nor ignored → "New account found" badge with Add/Ignore. Ignore records `${connId}:${externalAccountId}` in `AppSettings.ignoredExternalAccounts` permanently (visible/clearable in Settings).
- Each connection processed independently within a sync run — one connection's failure never blocks another's.

### Error taxonomy

| Condition | Scope | Behavior |
|---|---|---|
| `con.auth` | that account | `needsReconnect: true`, independently per account; links out to SimpleFIN Bridge's hosted reauth page |
| other `con.*`/`act.*` errors | that account | `syncIssue` badge showing the server's `msg` verbatim |
| Missing account, no remap match | that account | `missing: true` badge |
| New unrecognized account id | that account | "New account found" badge with Add/Ignore |
| Rate-limited / quota near-exhausted | whole sync run | Sync marked failed, surfaced via the "errors" notification trigger (§6), no auto-retry; `lastSyncDate` untouched if this was auto-sync-on-open |
| Unreachable (no response) | whole sync run | Same as rate-limited |

### Posted transactions

Upserted by SimpleFIN's transaction `id`. New id → mapped to `Transaction` (`date` = `posted`, `amount` parsed from the decimal string, sign already matches: positive = deposit) → run once through the auto-categorization heuristic (§3.1) → persisted. An already-known id has only mutable fields updated (e.g. amount settling) — **never re-categorized**, so a user's manual correction is never clobbered.

### Pending transactions

Fully transient. Every sync, per account: delete all stored pending transactions for that account, replace with whatever the fresh response contains, run each through categorization fresh. Locked from manual editing while pending. On settling, the transaction simply stops appearing as pending and shows up as an independent new posted transaction with no continuity assumed between the two records.

### Holdings

Ignored entirely for v1 — balance and any real transactions on brokerage-type accounts still sync normally; the `holdings` field is not read.

*(Detail: [SimpleFIN CORS & protocol research](../issues/10-simplefin-cors-protocol-research.md), [research notes](10-research-notes.md), [SimpleFIN access-layer design](../issues/11-simplefin-access-layer-design.md), [Obtain a SimpleFIN Bridge setup token](../issues/09-obtain-simplefin-token.md))*

### 3.1 Auto-categorization

**Pure local heuristic — no external classification service for v1.** SimpleFIN's transaction schema gives only `description` as raw merchant text (no `payee`/`memo`/`merchantId` to anchor on), plus `amount`, `posted`, `pending`, and account identity.

**Normalization pipeline** on `description`: case-fold → strip noise-label prefixes (generalized from old Spearmint's hardcoded list) → strip `$`-amount and date fragments → strip long mixed-alphanumeric reference/terminal-ID tokens → collapse whitespace → cap at 40 chars (a safety cap, not the primary noise-removal mechanism).

**Multi-signal weighted score** against each stored `CategorizationRule`:
- name similarity via token-set Jaccard — weight 0.5
- amount proximity within 5% — weight 0.25
- same-account as a candidacy gate — weight 0.15
- day-of-month recurrence proximity — weight 0.10

(Weights are tunable defaults, not final.)

**Three-tier outcome**:
- score ≥0.85 with ≥0.10 margin over runner-up → auto-apply silently
- 0.60–0.85, or margin <0.10 → dismissible one-tap suggestion
- <0.60 → no action

Ties broken by taking the single highest-scoring candidate, never merging.

**External services** (Plaid Enrich, Ntropy, Akahu Genie, MX) were surveyed against vendor primary sources: none document browser-safe/CORS calling. Using any of them today means either shipping a secret API key client-side or standing up a backend proxy — either undoes §3's no-backend decision for the sake of one feature. Deferred as a possible future opt-in enhancement (see §9).

*(Detail: [Auto-categorization approach](../issues/12-auto-categorization-approach.md), [full research](12-auto-categorization-research.md))*

---

## 4. Budgets & rollover engine

Peppermint's engine is reused with one targeted fix, no schema changes.

- **Display rollup** (`budget-summary.util.ts`'s `buildBudgetBranchRows`) already sums amounts bottom-up across a branch correctly — unchanged.
- **Carry-forward rollup** (`budgets.service.ts`'s `recomputeRolloversInMemory`) had a gap: `getMonthlyActualAmount` only summed a category's *direct* transactions, so a parent like "Housing" with all spend landing on children ("Rent", "Utilities") always showed 0 actual spend and rolled its entire budget over untouched.

**Fix**: replace the direct lookup with a recursive rollup that stops at the first budgeted descendant — an unbudgeted child's spend falls through to the nearest budgeted ancestor; a budgeted child manages its own envelope and is never double-counted into a parent's.

```ts
private getRollupActualAmount(
    period: YearMonth,
    categoryId: string,
    categories: Category[],
    actualsByPeriodAndCategory: Map<string, number>,
    budgets: Budget[]
): number {
    const direct = this.getMonthlyActualAmount(actualsByPeriodAndCategory, period, categoryId);
    const children = categories.filter((c) => c.parentCategoryId === categoryId);

    const childContribution = children.reduce((sum, child) => {
        const childIsBudgetedThisPeriod = this.getEffectiveBudgetForScope(budgets, child.id, 'month', period) !== null;

        return sum + (childIsBudgetedThisPeriod
            ? 0  // child manages its own envelope — already carried in its own rollover chain
            : this.getRollupActualAmount(period, child.id, categories, actualsByPeriodAndCategory, budgets));
    }, 0);

    return direct + childContribution;
}
```

"Budgeted" is checked via the *effective-as-of-that-period* lookup the engine already uses elsewhere, not "has a budget ever" — a child only started being budgeted last month still had its earlier spend roll up into the parent.

**Income categories are excluded from carry-forward entirely.** The `max(0, previousAvailable − previousActual)` formula doesn't make sense applied to income. `scopeCategoryIds` is filtered to `'expense'`/`'transfer'` types only; `'income'`-typed budgets are compared target-vs-actual per period with no carry, and the UI offers no rollover toggle on an Income budget.

**No period-closing UI.** No modal, toast, or badge — that would reintroduce alert-like UI that §6 explicitly ruled out for budgets. The carried-over amount just appears as a labeled line — **"+$X rolled over from last month"** — on the Budget detail screen whenever `rolloverAmount > 0`, computed lazily on read.

### Budget alert / status display

No badge or notification alerts for budgets. Status is conveyed entirely via **progress-bar color**, three states: normal (green) / warning (amber) / over (red).

- Warning threshold: fixed **85%** globally, not configurable per category.
- Expense categories: green <85%, amber 85–100%, red ≥100%.
- Income categories invert the logic (tracking a target to meet/exceed): green at/above target, amber approaching from below, red well under target.
- Rollover counts toward available budget: `percent = spent ÷ (amount + rolloverAmount)`.
- Label layout: dollar amount in small text above the bar; the bar itself shows a single percentage.

*(Detail: [Rollover engine generalization](../issues/17-rollover-engine-generalization.md), [Budget alert rules](../issues/14-budget-alert-rules.md))*

---

## 5. Auth & backup

**Fully local auth** — completes the "authenticate locally" work already underway in this repo (`src/app/auth/auth.service.ts`, `authenticateUserLocally$`). No server round trip for register or authenticate. Requests `authenticatorAttachment: 'platform'` and `userVerification: 'required'` so iOS surfaces FaceID/TouchID directly.

**Single-device by design.** No real-time or automatic multi-device sync.

**Export/import is the only backup and the only sync mechanism** — a full export of the local dataset (RxDB contents, including the WebAuthn credential) that can be re-imported to recover from storage loss, or manually carried to a second device. Export has a switch to encrypt or not: unencrypted is simpler to inspect/debug, encrypted is safer to store off-device (cloud drive, email to self). `AppSettings.exportEncryptionDefault` remembers the user's last choice.

Losing the local credential (storage cleared, device lost) means lockout, addressed only by export/import — no server-side recovery path exists or is planned.

*(Detail: [Local-only auth](../issues/04-local-auth.md), [Backup & sync scope](../issues/05-backup-sync-scope.md))*

---

## 6. Notifications

**In-app badge/alert only — no push notifications** (push would require service-worker + web-push infrastructure, reopening the no-backend decision).

**Triggers**: authentication issues (e.g. `needsReconnect`) and errors (e.g. failed sync run). Budget status is explicitly **not** a badge trigger — conveyed instead via progress-bar color (§4).

*(Detail: [Notifications scope](../issues/08-notifications-scope.md))*

---

## 7. Mobile IA

**Four bottom-nav tabs: Overview, Budgets, Transactions, Settings.** Accounts management lives under Settings, not its own tab. No Trends/graphs tab — budget progress bars already cover "am I on track"; charting is separate, out-of-scope work.

*(Detail: [Mobile IA & bottom nav](../issues/06-mobile-ia-bottom-nav.md))*

### Category taxonomy

Small hierarchical mint.com-style starter set (not Plaid's flat ~100-entry taxonomy), freely editable after seeding. Income is a first-class category type with its own budget treatment. Adopts Peppermint's hierarchy validation (cycle detection, sibling dup-name, delete-blocked-if-has-subcategories).

**Default seed** — 13 top-level categories, ~48 entries total, same `{name, type, parentName}` shape as Peppermint's `categories.service.ts`:

| Top-level | Subcategories |
|---|---|
| Income | Paycheck, Interest Income, Refunds & Reimbursements, Other Income |
| Housing | Rent, Mortgage, Home Insurance, Home Improvement, Maintenance & Repairs |
| Transportation | Gas & Fuel, Auto Payment, Auto Insurance, Public Transit, Parking & Tolls, Service & Repairs |
| Food & Dining | Groceries, Restaurants, Coffee Shops, Fast Food |
| Bills & Utilities | Electricity & Gas, Water, Internet & Cable, Phone, Subscriptions |
| Entertainment | Movies & Shows, Music, Hobbies, Games |
| Shopping | Clothing, Electronics, Home & Garden, General Merchandise |
| Health & Fitness | Doctor & Dentist, Pharmacy, Health Insurance, Gym & Fitness |
| Personal Care | Hair & Grooming, Spa & Massage |
| Travel | Flights, Hotels & Lodging, Rental Cars |
| Gifts & Donations | Gifts, Charitable Donations |
| Miscellaneous | Uncategorized, Fees & Charges |
| Transfer | Credit Card Payment, Account Transfer |

Every subcategory takes its parent's `type`. `Transfer` is its own `CategoryType` (§1) — resolved as a third type rather than overloading `'expense'`, so budget/reporting consumers never need an implicit "don't count this" exception.

*(Detail: [Category taxonomy approach](../issues/07-category-taxonomy-approach.md), [Default category list](../issues/13-default-category-list.md))*

---

## 8. Visual design

### Color theme

`#00D639` (HSL 136°, 100%, 42%) as primary; supporting tokens derived fresh, not adapted from Peppermint's muted-teal palette.

```scss
$spearmint-primary:        #00D639;   // HSL 136°, 100%, 42%
$spearmint-primary-rgb:    0, 214, 57;
$spearmint-accent:         #699ABF;   // muted blue — links/icons/secondary UI
$spearmint-bg:              #F9FBFA;
$spearmint-surface:        #FFFFFF;
$spearmint-border:         #DDE4DF;
$spearmint-danger:         #DF2030;
$spearmint-warning:        #FFB029;
$spearmint-success:        #137C67;   // deep teal-green — 32° hue-shift from primary, deliberately not a tint of it
$spearmint-ink:             #15251B;
$spearmint-on-primary:     #15251B;   // text/icons ON primary — primary fails white-text contrast (1.97)
$spearmint-on-accent:      #FFFFFF;
$spearmint-overlay:        rgba(21, 37, 27, 0.45);
$spearmint-shadow:         0 2px 8px rgba(21, 37, 27, 0.10);
$spearmint-shadow-strong:  0 4px 16px rgba(21, 37, 27, 0.18);
$spearmint-radius:         14px;
$spearmint-font-family:    'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
```

Mirrored as CSS custom properties (`--spearmint-*`) under `:root`. Both `primary` and `warning` fail WCAG AA for white text (1.97 and 1.83 respectively) and must use `$spearmint-on-primary` dark ink instead (8.3:1 / 8.9:1). `danger` (4.79) and `success` (5.11) pass AA for white text directly. `accent` (3.01) is scoped to non-text UI (borders, icons, links), not solid-fill button labels.

`success` is deliberately pushed 32° around the wheel into teal territory (not a lighter/darker primary green) so a success state never visually fuses with ordinary brand-colored surfaces.

**Dark mode is out of scope for v1** (see §9) — tokens are CSS custom properties specifically so a `[data-theme="dark"]` override block can be added later without a rework.

### Key screens prototype

Locked visual language — **"Card Stack"** — proven via a clickable static HTML/CSS/JS prototype: [`18-key-screens-prototype.html`](18-key-screens-prototype.html). Three structurally different treatments were built and compared (Card Stack / Compact List / Sectioned Minimal); Card Stack won and was iterated against reference mint.com mobile screenshots.

Across all 4 screens (Overview, Budget detail, Transaction list, bottom-nav shell):

- Full-bleed gradient hero band (`linear-gradient(165deg, #0D2A20 → #0F5E44 → #12A85A → #00D639)`, derived from the theme tokens above) with white rounded cards overlapping its bottom edge.
- Bottom nav carries the same gradient, auto-hides on scroll-down, reveals on scroll-up/near-top; inactive labels translucent white, active tab a primary-green pill with dark-ink icon.
- Headers scroll with content (not pinned) on all 4 screens — a pinned header would fight the overlap-card motif.
- Each header carries a real stat: Overview shows total balance + month-over-month delta (plain text, not a chart); Budgets shows total spent-of-budgeted + an encouragement line (~1/3 of screen height); Transactions shows total spent this month + count; Settings shows a plain headline.
- Overview's account summary is two type-aggregated total cards (Cash / Credit cards, filterable via pills), not a per-account list; individual accounts (incl. `needsReconnect`) stay on Settings, with a bell-icon badge on Overview surfacing the reconnect signal.
- Budget detail and the Budgets-tab bars implement the three-state coloring from §4 exactly, including the income-inverted case; the Budgets-tab aggregate bar additionally gets a "▲ Today" tick at the elapsed-day-of-month mark. The rollover pill ("+$X rolled over from last month") appears on Budget Detail only when `rolloverAmount > 0`.
- A cash-flow (Earned vs. Spent) two-bar comparison on the Budgets tab is a static aggregate, not a time series — flagged and confirmed as not reopening the Trends/graphs out-of-scope call.

*(Detail: [UI design & prototype scope](../issues/01-ui-design-prototype-scope.md), [Color theme tokens](../issues/15-color-theme-tokens.md), [Key screens prototype](../issues/18-key-screens-prototype.md))*

---

## 9. Out of scope

Ruled beyond this rebuild's destination — revisit only as a fresh effort if the destination itself is redrawn:

- **Trends/graphs/charting** — no charting feature this pass.
- **Push notifications** — in-app badge only, no push infrastructure.
- **Real-time multi-device sync** — single-device app, manual export/import only.
- **Migrating existing Spearmint data** — old database dropped completely; new app starts fresh.
- **External merchant-classification service** (Plaid Enrich, Ntropy, Akahu, MX) — surveyed, none support safe browser-direct calls without a backend proxy; possible future opt-in enhancement.
- **Dark mode** — no dark palette defined; tokens are CSS custom properties so `[data-theme="dark"]` can be added later.
- **Manual (non-SimpleFIN) transaction entry** — Transaction is modeled as SimpleFIN-sourced only.

---

## 10. Suggested implementation phasing

Not a map decision — offered here only as a starting sequence for the implementation effort, since phase/milestone sequencing was deliberately kept off this map (see the map's Notes).

1. **Foundation**: Angular project scaffold, RxDB schema for all §1 entities, WebAuthn local auth (§5), color theme tokens (§8) as global SCSS/CSS custom properties, bottom-nav shell (§7).
2. **SimpleFIN ingest**: access-layer service (§3) — claim UX, sync scheduling, account remap/discovery, error taxonomy, posted/pending transaction upsert.
3. **Categorization**: default category seed + hierarchy validation (§7), auto-categorization heuristic + `CategorizationRule` (§3.1).
4. **Budgets**: Budget CRUD, rollover engine port + parent-rollup fix (§4), three-state progress-bar status.
5. **Key screens**: build Overview, Budget detail, Transaction list, Settings against the locked prototype (§8).
6. **Backup**: export/import with optional encryption (§5).
7. **Polish**: notification badges (§6), reconnect/missing/new-account flows surfaced in UI, remaining Settings screens.

---

*Assembled from all resolved tickets on the [Spearmint Rebuild map](../map.md). See [Assemble the consolidated spec/architecture document](../issues/19-assemble-final-spec.md) for this ticket's own record.*
