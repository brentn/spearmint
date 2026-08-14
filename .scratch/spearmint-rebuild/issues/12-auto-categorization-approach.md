Type: research
Status: resolved

## Question

Old Spearmint's "Transformation" feature (`data/models/transformation.ts`) auto-applies a user's past merchant/category corrections to future transactions, but matches on a simple fingerprint (accountId + categoryId + merchantId + a cleaned name-prefix substring). Brent wants this carried forward but made smarter than a substring match. He's kept everything else local-only for simplicity (no backend to build/maintain), not as an absolute privacy line — so he's open to a free/cheap external classification service if that's genuinely the best approach, even though it would mean merchant data leaving the device for this one feature.

Research: what would a smarter *local* heuristic look like (fuzzy/normalized merchant matching, multi-signal scoring using whatever fields SimpleFIN actually provides per [#10](10-simplefin-cors-protocol-research.md))? Separately, what free or low-cost external merchant-categorization/classification services exist, and how would they compare on accuracy, cost, and integration effort? Recommend an approach.

## Answer

**Pure local heuristic — no external service, at least for v1.** Full research: [12-auto-categorization-research.md](../assets/12-auto-categorization-research.md).

SimpleFIN's transaction schema (confirmed against `simplefin.org/protocol.html` and `beta-bridge.simplefin.org/info/developers`) gives only `description` as raw merchant text — no `payee`/`memo`, and no Plaid-style `merchantId` to anchor on — plus `amount`, `posted`/`transacted_at`, `pending`, and account/connection identity. The new "correction memory" record (successor to old Spearmint's `Transformation`) replaces the old exact-fingerprint-plus-25-char-prefix match with:

- **Normalization pipeline** on `description`: case-fold → strip noise-label prefixes (generalized from old Spearmint's hardcoded `"Cheque Date"`/`"Confirmation #"`/`"Reference Number"` list) → strip `$`-amount and date fragments → strip long mixed-alphanumeric reference/terminal-ID tokens → collapse whitespace → cap at 40 chars (a safety cap, not the primary noise-removal mechanism the way old Spearmint's 25-char truncation was).
- **Multi-signal weighted score** against each stored record: name similarity via token-set Jaccard (0.5 weight), amount proximity within 5% (0.25), same-account as a candidacy gate (0.15), day-of-month recurrence proximity (0.10) — weights are tunable defaults for the domain-model ticket, not final.
- **Three-tier outcome** (the actual "smarter than substring match" improvement): score ≥0.85 with ≥0.10 margin over the runner-up → auto-apply silently; 0.60–0.85 or margin <0.10 → surface as a dismissible one-tap suggestion (a tier old Spearmint never had — it only ever silently force-applied or did nothing); <0.60 → no action. Ties are broken by taking the single highest-scoring candidate, never merging — this replaces old Spearmint's undefined last-write-wins behavior in its `reduce` over transformations.

**External services surveyed** (Plaid Enrich, Ntropy, Akahu Genie, MX) — all checked against vendor primary sources: none document browser-safe/CORS calling, so using any of them today means either shipping a secret API key client-side (a real exposure) or standing up a backend proxy (which undoes [No backend for SimpleFIN](03-no-backend-simplefin.md) for the sake of one feature). Ntropy has the best terms (2,000 free transactions, generous rate limits, self-serve sign-up) but only as a trial — no durable low-volume price is published. Deferred as a possible future opt-in enhancement, not built now.
