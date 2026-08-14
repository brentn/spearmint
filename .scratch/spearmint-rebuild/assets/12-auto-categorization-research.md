# Research: Auto-categorization approach (ticket #12)

Grounds the answer to [issues/12-auto-categorization-approach.md](../issues/12-auto-categorization-approach.md).

## 0. Old Spearmint's "Transformation" feature, exactly as implemented

Source: `src/app/data/models/transformation.ts` (repo root: `/Users/brent.nesbitt/Documents/Develop/Personal/Spearmint`).

**Model fields** (`src/app/data/models/transformation.ts:3-11`):
```ts
export class Transformation {
  accountId: string;
  categoryId: string;
  merchantId: string;
  paymentChannel: string;
  name: string;
  newCategoryId: string | undefined
  newMerchant: string | undefined;
  newHideFromBudget: boolean | undefined;
```

**Name cleaning on construction** (`src/app/data/models/transformation.ts:18-23`) — the "cleaned name-prefix" referenced in the ticket is built like this:
```ts
this.name = (incoming.name || '')
  .split('$')[0]
  .split('Cheque Date')[0]
  .split('Confirmation #')[0]
  .split('Reference Number')[0]
  .substring(0, 25);
```
i.e. truncate at the first `$`, the literal substring `"Cheque Date"`, `"Confirmation #"`, or `"Reference Number"` (whichever comes first), then hard-truncate to 25 characters. No lowercasing, no whitespace/number stripping.

**Matching logic** (`src/app/data/models/transformation.ts:29-40`):
```ts
matches(transaction: Transaction): boolean {
  if (this.accountId === transaction.accountId) {
    if (this.categoryId === transaction.categoryId) {
      if (this.merchantId === transaction.merchantId) {
        if (this.name === transaction.name.substring(0, this.name.length)) {
          return true;
        }
      }
    }
  }
  return false;
}
```
So a match requires exact equality on `accountId`, `categoryId` (the transaction's *current/pre-correction* category, not the corrected one), and `merchantId`, AND that the transaction's raw `name` starts with the stored cleaned/truncated `name` string (`transaction.name.substring(0, this.name.length) === this.name`). This is a strict prefix match on an already-truncated string — a `Transformation` created from `"AMAZON.COM*1AB2C3"` and truncated to `"AMAZON.COM*1AB2C3"[:25]` will only match future transactions whose raw name starts with that exact prefix (including the transaction-specific order-code fragment if it happened to fall within the first 25 characters), which is fragile.

**Application** (`src/app/transactions/transaction/form/transaction-form.component.ts:74-88`): when the user edits `merchant`, `categoryId`, or `hideFromBudget` on the transaction-edit form and any of those fields is dirty, a new `Transformation` is upserted from the transaction's *pre-edit* state plus the new values (`transaction-form.component.ts:76-81`).

**Upsert/dedup** (`src/app/data/database/dbState.service.ts:172-188`): on upsert, any existing transformation with the same `accountId` + `merchantId` + `categoryId` where the *new* transformation's name starts with the *old* one's name is replaced (`dbState.service.ts:177-182`) — this is a de-dup step, not the transaction-matching step.

**Apply-to-incoming-transactions logic** (`src/app/data/state/effects.ts:80-86`), inside the `addTransactions$` NgRx effect: every newly-imported transaction is run through *every* stored transformation via `Array.reduce`, applying whichever transformations match, in array order:
```ts
addTransactions$ = createEffect(() => this.actions$.pipe(
  ofType(addTransactions),
  withLatestFrom(this.dbState.transformations$),
  map(([action, transformations]) => action.payload.map(transaction =>
    transformations.reduce((t, transformation) => transformation.transform(t), transaction))),
  switchMap(transactions => this.dbState.Transactions.addMany$(transactions)),
  map(transactions => transactionsAdded(transactions))
));
```
`transform()` (`src/app/data/models/transformation.ts:42-53`) checks `matches()` and, if true, returns a new `Transaction` with `merchant`, `categoryId`, and `hideFromBudget` overwritten from the transformation's `newMerchant` / `newCategoryId` / `newHideFromBudget`. Because this is a plain reduce with no score/priority, **whichever matching transformation is encountered last in the array wins** if more than one matches — there is no notion of "best match," confidence, or tie-breaking.

**Transaction model fields available for matching** (`src/app/data/models/transaction.ts:2-14`): `id`, `date`, `accountId`, `merchantId`, `merchant`, `paymentChannel`, `name`, `amount`, `categoryId`, `notes`, `hideFromBudget`, `seen`. Note `merchantId` and `paymentChannel` came from Plaid (being dropped per map.md's "SimpleFIN replaces Plaid" decision), so they will not exist as-is in the rebuild — see §1 below for what SimpleFIN actually gives instead.

### Peppermint: no analogous feature found

Searched `/Users/brent.nesbitt/Documents/Develop/Personal/Peppermint/src` for `transform|categoriz|merchant.*match|auto.*categor|correction|rule|memory|remember|fuzzy|levenshtein|similarity` (all `.ts`, excluding specs). Findings:
- `src/shared/components/uncategorized-transactions/uncategorized-transactions.component.ts` is a manual categorization UI only: it lets the user pick a category per uncategorized transaction and emits a `CategorizeTransactionEvent` (`uncategorized-transactions.component.ts:6-9, 46-63`). No memory of past corrections, no matching against future transactions.
- The only "rule"-shaped code in the repo is `src/shared/utils/email-ingest-metadata.util.ts` (`InstitutionRegexRule`, `InstitutionSenderRule`), which is regex parsing configuration for the Gmail-notification-parsing ingest pipeline (institution email format matching), unrelated to merchant/category matching and explicitly out of scope for the rebuild per map.md line 9.

**Conclusion: Peppermint has no auto-categorization-memory analog.** This feature's design must come from old Spearmint (as a "what to improve" baseline) and from first principles grounded in SimpleFIN's schema, not from Peppermint.

---

## 1. Local heuristic design

### 1a. SimpleFIN schema, as actually documented (primary sources)

Fetched directly via WebFetch on 2026-08-13:
- https://www.simplefin.org/protocol.html
- https://beta-bridge.simplefin.org/info/developers

**Transaction object fields** (per simplefin.org/protocol.html):

| Field | Type | Description (as documented) |
|---|---|---|
| `id` | string | "An ID that uniquely describes a transaction within an Account" |
| `posted` | UNIX epoch timestamp | "When the transaction posted to the account. If pending, may be `0`" |
| `amount` | numeric string | "Amount of transaction. Positive numbers indicate money deposited into the account" |
| `description` | string | "A human-readable description of what the transaction was for" |
| `transacted_at` | UNIX epoch timestamp | "When the transaction happened" (optional) |
| `pending` | boolean | "`true` indicates transaction has not yet posted. Default is `false`" (optional) |
| `extra` | object | "Extra transaction-specific data not defined in standard" (optional) |

**Important negative finding:** SimpleFIN's transaction object does **not** document a `payee` or `memo` field. The only human-readable merchant text is `description`. (Confirmed against both the protocol page and the beta-bridge developer example, which itself only demonstrates `posted`, `amount`, `description` on transactions — beta-bridge.simplefin.org/info/developers.) Any matching heuristic must work off `description` alone as the raw text signal, plus whatever a given institution stuffs into the optional `extra` object (undocumented/non-standard, cannot be relied on generically).

**Amount sign convention:** positive = deposit into account, negative = withdrawal (simplefin.org/protocol.html). This is the opposite convention from old Spearmint/Plaid's `amount` field in some configurations, so the rebuild's normalization layer needs to pin this down explicitly — noted here as a signal for ticket #11 (access-layer design), not solved in this ticket.

**Account object fields** (per simplefin.org/protocol.html):

| Field | Type | Description |
|---|---|---|
| `id` | string | uniquely identifies the account within the Connection |
| `name` | string | uniquely describes the account among the user's other accounts |
| `conn_id` | string | ID of the account's Connection |
| `currency` | string | ISO 4217 code (e.g. `USD`) or custom currency URL |
| `balance` | numeric string | account balance as of `balance-date` |
| `available-balance` | numeric string | optional, may be omitted if same as `balance` |
| `balance-date` | UNIX epoch timestamp | when balance became current |
| `transactions` | array | optional subset of transactions, ordered by `posted` |
| `extra` | object | optional, non-standard |

**Connection object** (replaces the deprecated "Organization" object as of protocol v2.0.0, per simplefin.org/protocol.html): `conn_id`, `name` (human-friendly, includes institution name), `org_id` (institution ID, unique per server only), `org_url` (optional, institution domain), `sfin_url` (root URL of the org's SimpleFIN server). Useful as an **account-level** signal (which institution/connection an account belongs to), but not a merchant-level signal.

**Endpoint/request shape** (per beta-bridge.simplefin.org/info/developers): `GET /accounts?version=2`, with optional `account=` filter and `start-date`/`end-date` params (date range limited to 90 days at a time per that page's example). Errors surface in an `errlist` array property on the `/accounts` response; rate-limit warnings appear in an `errors` array. The claim flow is: base64-decode a setup token to get a URL, `POST` to it once to receive an `ACCESS_URL` (single-use — the setup token is invalidated once claimed). No mention of CORS/browser-support on this page; that question belongs to ticket #10, which is still open as of this writing (`issues/10-simplefin-cors-protocol-research.md`) — **not answered here, only the schema is used from these sources.**

### 1b. What this means for the matching heuristic

Because SimpleFIN gives only `description` (raw merchant text) plus `amount`, `posted`/`transacted_at`, `pending`, and account/connection identity — and explicitly nothing structured like Plaid's `merchantId` or `paymentChannel` — the rebuild's "correction memory" record can no longer key off a stable `merchantId` the way old Spearmint did (`transformation.ts:6,16` — `merchantId` was Plaid-supplied). The new heuristic has to derive merchant identity itself from `description` text, using normalization + fuzzy matching, and lean more heavily on `amount` and recurrence as corroborating signals since there's no first-party merchant ID to anchor on.

### 1c. Proposed local matching heuristic

**Normalization pipeline for `description` (apply in this order, both when storing a correction and when matching an incoming transaction):**
1. Uppercase (or lowercase — pick one; consistency matters more than case).
2. Strip trailing/embedded reference-code patterns: sequences that look like POS terminal IDs, store numbers, or confirmation/reference codes — e.g. regex-strip trailing runs of `#\d+`, standalone hex/alphanumeric tokens of length ≥6 that mix letters and digits (typical of authorization/reference codes), and known label prefixes carried over from old Spearmint's cleaning list (`"Cheque Date"`, `"Confirmation #"`, `"Reference Number"` — `transformation.ts:19-22`) generalized to a configurable list rather than hardcoded literals.
3. Strip dates (`MM/DD`, `MM-DD-YY`, ISO fragments) and dollar-amount fragments (old Spearmint's `split('$')[0]` — `transformation.ts:19` — generalized to a `\$\d` regex rather than first-`$`-only, since merchant names occasionally contain a legitimate `$` before the transaction reference amount).
4. Collapse multiple spaces/punctuation runs to a single space; trim.
5. Truncate to a fixed max length (e.g. 40 chars — longer than old Spearmint's 25, since normalization already removed the noisy suffix, so truncation is now a safety cap, not the primary noise-removal mechanism) but do **not** rely on truncation for matching — compare the whole normalized string, not a prefix.

**Similarity function:** token-based Jaccard or a normalized Levenshtein ratio (e.g. `1 - levenshteinDistance / max(len1, len2)`) over the normalized strings from step 5. Token-based (split on whitespace, compare token sets) is more robust to word-order/insertion noise than raw Levenshtein for merchant strings like `"AMZN MKTP US*2K3L4"` vs `"AMAZON MKTP US"`; recommend token-set Jaccard as primary with Levenshtein ratio as a tiebreaker/secondary signal, both are cheap enough to run fully client-side over a few hundred stored correction records.

**Multi-signal score, combined as a weighted sum against each stored "correction memory" record:**

| Signal | How computed | Suggested weight |
|---|---|---|
| Name similarity | token-Jaccard(normalized incoming `description`, normalized stored `description`) | 0.5 |
| Amount similarity | 1 if `abs(amount - storedAmount) / max(abs(amount), abs(storedAmount), 1) <= 0.05` (within 5%), else a decayed value, else 0 if wildly different | 0.25 |
| Account match | 1 if `accountId` equal, else 0 (hard requirement candidate — see below) | 0.15 |
| Recurrence/day-of-month proximity | 1 if incoming transaction's day-of-month is within e.g. 3 days of the stored record's typical day-of-month (tracked as a rolling average across matches), else scaled down | 0.10 |

Weights are a starting point for the domain-modeling ticket to tune, not a locked constant — call this out explicitly to whoever implements ticket's final domain model.

**Auto-apply / suggest / no-match thresholds:**
- Score ≥ 0.85 **and** account matches **and** margin over the second-best candidate ≥ 0.10 → auto-apply silently (mirrors old Spearmint's silent-apply UX, `effects.ts:80-86`).
- Score ≥ 0.60 but below the auto-apply bar, or margin over second-best < 0.10 → surface as a one-tap suggestion in the transaction-edit UI rather than silently applying (this is the "smarter than substring match" improvement Brent asked for — the old code had no suggestion tier, it either force-applied or did nothing).
- Score < 0.60 → no match, transaction stays uncategorized/as-imported.
- Multiple candidates above the suggestion threshold: rank by score, take the highest as the presented suggestion (or auto-apply target); do not average or merge candidates. This directly fixes old Spearmint's undefined-tie-break-via-reduce behavior (`effects.ts:83`, whichever transformation matched last silently won).

Requiring `accountId` equality as a near-hard filter (weight 0.15 but effectively gating candidacy — i.e. only score records for the same account) mirrors old Spearmint's behavior (`transformation.ts:30`) and remains sound: a merchant string colliding across two different accounts belonging to the same user is a legitimate scenario (e.g. same coffee shop charged to two different cards) that should still get separate corrections per account, consistent with the old design.

---

## 2. External service survey

All checked against each vendor's own site/docs via WebFetch/WebSearch on 2026-08-13. None publish a live sandbox this agent could call, so accuracy/pricing are as published, not independently verified.

### Plaid Enrich
- **What it does:** Both categorization and merchant identification — "Cleanse, categorize, and enhance transaction data," with features listed as "Clean merchant details" and "Smart categorization" (https://plaid.com/products/enrich/).
- **Accuracy claims:** No categorization-specific accuracy percentage found on the Enrich product page itself. A separate Plaid blog post on their AI-enhanced categorization model claims "up to 10% higher accuracy on primary categories and 20% higher accuracy on detailed sub-categories" (found via search of https://plaid.com/blog/ai-enhanced-transaction-categorization/; not independently re-verified against the blog post's own body text via a second fetch — treat as a search-summarized figure, flagged accordingly).
- **Cost at low volume:** No self-serve/free tier for Enrich specifically. The general Plaid pricing page (https://plaid.com/pricing/) states "Our Limited Production service allows you to make up to 200 API calls with each available product using live data" but does not confirm Enrich is included, and does not publish per-call pricing — Enrich requires "apply for Production access or contact sales" (https://plaid.com/products/enrich/).
- **Integration effort:** Server-side by design — Plaid's model throughout its docs is secret-key auth exchanged for access tokens via backend calls; no CORS/browser-direct support is advertised anywhere checked. Requires a backend proxy.
- **Verdict:** Not viable for a zero-backend hobby app — enterprise sales gate, no published low-volume pricing, backend-only integration model.

### Ntropy
- **What it does:** "Entity identification" (merchant/who), "categorization" (why), and "recurrence detection" (https://ntropy.com/txen, https://docs.ntropy.com/introduction). Also offers bank-statement OCR as a separate capability.
- **Accuracy claims:** Only qualitative — "superhuman accuracy but 10,000x cheaper," "state-of-the-art performance in all categories" (https://ntropy.com/txen, https://docs.ntropy.com/introduction). No numeric accuracy figure found on any page fetched.
- **Cost at low volume:** "Test 2,000 transactions free then upgrade to a no commitment plans or custom pricing for large volumes" (https://www.ntropy.com/txen). This free allotment (2,000 transactions) comfortably covers "a few hundred transactions/month" for a single-user hobby app, at least for an initial period — but no page fetched states what happens or what it costs per-transaction once the trial is exhausted; "no commitment plans" wording is vague, actual $/transaction not published anywhere checked.
- **Integration effort:** API-key based ("generated automatically for your organization," rotatable via dashboard — https://docs.ntropy.com/onboarding). No mention of CORS or browser-callable design on the onboarding or introduction pages; the implicit model (typical of this category of vendor) is server-side calls with a secret key. Rate limits: per-key "transaction credits" — accumulate up to 50,000 credits refilled at 500/sec, up to 10 concurrent enrichment operations, most endpoints 10 ops/sec (POST `/v3/transactions` and `/v3/batches` at 20 ops/sec, POST `/v3/account_holders` at 100 ops/sec) — https://docs.ntropy.com/api/rate-limits. These limits are generous for hobby volume regardless of integration model.
- **Verdict:** Best-documented free tier of the three vendors surveyed, and the only one with an accessible (non-sales-gated) sign-up path per the pages checked. Still API-key/server-oriented by every signal found; no explicit statement it's safe or supported for direct browser calls.

### Akahu (Genie)
- **What it does:** Genie is described as exposing "Akahu's transaction enrichment engine for applications that source raw transaction data themselves" — pass a raw description or payee account number, get back trading name, category, description, logo, location, website, NZBN, confidence score (0–0.99) (https://developers.akahu.nz/docs/genie).
- **Accuracy claims:** Explicitly unformalized — "We are still tweaking the maths behind this value, and intend to release guidelines for usage once it becomes stable" regarding the confidence score (https://developers.akahu.nz/docs/genie). No accuracy percentage published.
- **Cost at low volume:** Akahu's general pricing page states data-API pricing like "$1.00 per successful request" for identity/bank-account verification and "$0.50–$2.50 per user per month" for ongoing connectivity (https://www.akahu.nz/pricing) — but this page does not mention Genie or transaction-enrichment pricing specifically; Genie access requires contacting Akahu directly for an API key per the docs page.
- **Integration effort:** Bearer-token auth (`Authorization: Bearer genie_token_...` — https://developers.akahu.nz/docs/genie). No mention of CORS/browser support anywhere on the page; the token-in-header model plus no frontend-integration guidance suggests server-side use only, per the page's silence on the topic.
- **Geography:** Genie is explicitly NZ-focused — "limited support for enrichment of overseas transactions" (https://developers.akahu.nz/docs/genie). Since Spearmint/SimpleFIN targets US institutions (SimpleFIN is a US-centric protocol), Akahu Genie is likely a poor merchant-coverage fit regardless of the other factors.
- **Verdict:** Geographic mismatch alone rules this out for a US-based user; also gated behind a manual "contact us" API key request, not self-serve.

### MX
- **What it does:** Described in its own marketing as best-in-class "data cleanliness, classification, and enrichment" (per third-party comparison summaries; MX's own page: https://www.mx.com/products/data/).
- **Accuracy claims:** None found — the product page uses only qualitative language ("advanced data enhancement"), no quantified benchmark (https://www.mx.com/products/data/).
- **Cost at low volume:** No self-serve pricing published; page's only calls-to-action are "Request Demo" (https://www.mx.com/products/data/). Enterprise sales-gated.
- **Integration effort:** Unknown/unpublished — no docs reachable without a sales relationship.
- **Verdict:** Not viable for a hobby app — no public pricing or self-serve path at all.

### Cross-vendor conclusion

**None of the four surveyed services document CORS support or state they can be safely called directly from a browser.** Every one uses an API-key-in-header or secret-token auth model with no stated client-side-safe mode, which is the standard pattern for this class of financial-data vendor (their docs simply don't address a browser-only use case because it isn't their target integration). For a genuinely zero-backend, browser-only app, using any of these directly would mean embedding a secret API key in shipped frontend JS, retrievable by anyone via devtools/network tab — the exact risk the ticket flags. The only way to use one of these safely would be to stand up a minimal backend/serverless proxy solely to hide the key, which contradicts the rebuild's no-backend decision (`issues/03-no-backend-simplefin.md`) for a feature that isn't SimpleFIN access itself.

---

## Recommendation

**Pure local heuristic (§1c), with the external-service question deliberately deferred, not built now.**

**Why not external, even the best option (Ntropy):** every vendor checked is API-key/server-oriented with no documented browser-safe calling convention, so adopting one today means either (a) shipping a secret key client-side — a real, not theoretical, exposure since it's visible in any browser's network tab, or (b) building a backend proxy — which undoes the "no backend" simplicity decision (`issues/03-no-backend-simplefin.md`, `issues/05-backup-sync-scope.md`) for the sake of one feature. Ntropy's free 2,000-transaction trial is real and generous for a hobby volume, but it's a trial, not a durable free tier — the docs don't state a lasting low-volume price, so committing the domain model to it now risks building against a pricing cliff no one has confirmed. This is exactly the kind of decision map.md's "Not yet specified" section already anticipates deferring (map.md:32: "Whichever classification approach ticket #12 lands on may surface its own follow-up questions... not specifiable until #12 resolves").

**Why the local heuristic is sufficient for v1:** SimpleFIN's `description` field (§1a) plus `amount`, `posted`/`transacted_at`, and account/connection identity give enough signal for the multi-factor score in §1c to meaningfully outperform old Spearmint's plain prefix match — the improvement isn't fuzzier text matching alone, it's combining name similarity with amount and recurrence so that near-miss merchant strings (different POS suffix, different date/reference fragment) still match confidently, while unrelated transactions that happen to share a truncated prefix (old code's real failure mode) don't.

**Concrete algorithm for the domain-model ticket to implement:**

1. **Stored "correction memory" record** (successor to `Transformation`) should read/write these fields: `accountId`, `categoryId` (the category being corrected *from*, i.e. what an incoming transaction currently has — nullable/absent for "no prior category"), `normalizedDescription` (output of the §1c pipeline, not the raw string), `rawDescriptionSample` (kept for potential future debugging/display, not used in matching), `amount` (signed, per SimpleFIN's deposit-positive convention), `dayOfMonth` (derived from `posted`/`transacted_at` at creation time), `newCategoryId`, `newMerchant` (a user-facing display name, analogous to old `newMerchant` — `transformation.ts:10,46`), `newHideFromBudget`.
2. **Incoming transaction fields read:** `accountId`, `categoryId` (current/as-imported), `description` (raw, from SimpleFIN), `amount`, `posted`/`transacted_at`.
3. **Normalization order** (apply identically to both stored records at creation time and incoming transactions at match time): uppercase → strip known noise-label prefixes (configurable list, generalized from old Spearmint's hardcoded `"Cheque Date"`/`"Confirmation #"`/`"Reference Number"` — `transformation.ts:19-22`) → strip `$`-amount fragments via regex → strip date-like fragments → strip long mixed alphanumeric reference/terminal-ID tokens → collapse whitespace/punctuation → trim → cap at 40 chars.
4. **Similarity functions:** token-set Jaccard similarity as primary name-similarity signal; normalized Levenshtein ratio as a secondary/tiebreak signal if Jaccard scores tie across candidates.
5. **Score combination:** weighted sum per the table in §1c (name 0.5, amount-proximity 0.25, account-match 0.15 as a candidacy gate, day-of-month proximity 0.10) — weights explicitly marked as tunable defaults, not final.
6. **Thresholds:** ≥0.85 plus ≥0.10 margin over runner-up → auto-apply; 0.60–0.85 (or margin <0.10) → present as a dismissible one-tap suggestion; <0.60 → no action, transaction left as imported.
7. **Ties/multiple candidates:** score every candidate record for the same `accountId`, take the single highest-scoring one; never merge/average across candidates; the margin-over-second-best check in step 6 is what prevents a confident auto-apply when two candidates are nearly indistinguishable (this directly replaces old Spearmint's undefined last-write-wins `reduce` behavior at `effects.ts:83`).
8. **Low-confidence handling:** surfaced as a suggestion (step 6's middle tier), never silently skipped and never silently forced — this is the concrete behavioral upgrade over old Spearmint, which only ever silently force-applied or did nothing, with no middle tier.

**Path to revisit external services later:** note it in map.md's "Not yet specified" section (already flagged there) as a possible future optional enhancement — e.g. "let the user opt in to sending unmatched merchant descriptions to Ntropy's free tier for a one-time bulk categorization pass" — but do not build it as part of this ticket or the initial domain model. This keeps the rebuild's zero-backend simplicity intact for v1 while leaving the door open exactly as Brent described being willing to walk through if a service proved worth it.
