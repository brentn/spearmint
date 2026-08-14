Type: map

## Destination

A locked spec/architecture for a from-scratch rebuild of Spearmint (this repo's `master` branch) — not a deployed app. When every ticket on this map is resolved, we have: a finalized domain model, a finalized SimpleFIN access-layer design, a finalized auth/backup design, a finalized mobile IA, a set of clickable UI prototypes proving the mint.com-style look with #00D639 as primary, and a consolidated spec document assembling all of it — ready to hand to a separate implementation effort. No backend service; the app is a single static frontend, local-first, single-device (sync via manual export/import only).

Informed by two existing codebases, mined for decisions worth carrying forward or explicitly dropping:
- **Spearmint** (this repo, Angular 16): Plaid banking (being replaced by SimpleFIN), WebAuthn passkey auth (mid-pivot to fully local, being completed here), RxDB/IndexedDB client persistence (being kept), a flat Plaid-taxonomy category list (being replaced), and a "Transformation" auto-categorization-memory feature (being kept, but upgraded).
- **Peppermint** (sibling repo, Angular 21 standalone+Signals): a working rollover-budget engine and real category parent/child hierarchy (both being ported/generalized), a service→store→component layering convention (being adopted), and a Gmail-notification-parsing ingest pipeline (explicitly NOT being carried forward — SimpleFIN replaces it there too, per that repo's own TODO.md, but no SimpleFIN code exists there yet).

## Notes

- Domain: personal single-user budgeting app, mobile-first, styled after the old mint.com mobile app.
- Skills to consult per ticket: `/research` for SimpleFIN protocol and classification-service investigation; `/prototype` for the key-screens UI work; `/grilling` and `/domain-modeling` for remaining design decisions.
- Stack carried forward: Angular latest stable, standalone components, Signals, Bootstrap (mobile-first), Reactive Forms, RxDB over IndexedDB, FontAwesome icons. No backend, no NgRx (Peppermint's signal-store pattern replaces the entity-store role NgRx played in old Spearmint).
- Housekeeping (not a map decision, just noted for whoever implements): tag current `master` before deleting `src/API` and the old `src/app` tree, so history stays recoverable.
- Peppermint is a structural reference only: folder layout, service→store→component conventions, and library choices may borrow from it, but visual style (colors, palette derivation) must not — Spearmint's look is its own, anchored on #00D639, not adapted from Peppermint's theme.

## Decisions so far

- [UI design & prototype scope](issues/01-ui-design-prototype-scope.md) — Lock UI design as part of this map's destination; prove it via clickable prototypes of 4 key screens, not a written style guide alone.
- [Persistence layer](issues/02-persistence-layer.md) — RxDB/IndexedDB carried forward from Spearmint; old database dropped completely, no migration.
- [No backend for SimpleFIN](issues/03-no-backend-simplefin.md) — SimpleFIN accessed directly from the frontend via a dedicated access-layer service; no server component. Contingent on CORS research (#10).
- [Local-only auth](issues/04-local-auth.md) — WebAuthn/passkey auth fully client-side, using the platform authenticator (FaceID on iPhone) — completes the "authenticate locally" work already underway.
- [Backup & sync scope](issues/05-backup-sync-scope.md) — Export/import with an optional encryption toggle is the only backup and the only cross-device sync mechanism; app is single-device by design.
- [Mobile IA & bottom nav](issues/06-mobile-ia-bottom-nav.md) — Four tabs: Overview, Budgets, Transactions, Settings. Accounts lives under Settings. No Trends/graphs tab.
- [Category taxonomy approach](issues/07-category-taxonomy-approach.md) — Small hierarchical mint.com-style default category set (parent/child) replaces Plaid's flat ~100-entry taxonomy; Income is a first-class category type.
- [Notifications scope](issues/08-notifications-scope.md) — In-app badge/alert only (no push notifications, confirmed). Triggers: auth issues and errors (budget alerts dropped as a trigger — see Budget alert rules).
- [Obtain a SimpleFIN Bridge setup token](issues/09-obtain-simplefin-token.md) — Brent signed up, subscribed, linked a real account, and holds a working access URL (kept outside the repo) — unblocks the CORS/protocol research and access-layer design tickets.
- [Auto-categorization approach](issues/12-auto-categorization-approach.md) — Pure local heuristic (normalized-description similarity + amount + account + recurrence, weighted, three-tier auto-apply/suggest/no-match). No external classification service for v1 — none of the surveyed vendors (Plaid Enrich, Ntropy, Akahu, MX) support safe browser-direct calls.
- [SimpleFIN access-layer design](issues/11-simplefin-access-layer-design.md) — Angular access-layer service: 1x/day auto sync gated by `lastSyncDate` (only advances on success) + manual "Sync now", `[lastSyncDate−7d, today]` window with chunked backfill past 90 days, plaintext access-URL in RxDB, `connId` flat on Account (no Connection entity) with per-account `needsReconnect` flagging, account remap-by-name within a connection plus new-account discovery, pending transactions fully transient (wiped/reinstated + re-categorized every sync, locked from editing), posted transactions upserted by id and categorized once, holdings ignored for v1.
- [SimpleFIN CORS & protocol research](issues/10-simplefin-cors-protocol-research.md) — Confirmed empirically: direct browser calls work (proper CORS headers on both success and error responses), validating no-backend. Re-auth (`con.auth`) has no API fix — app must link the user out to SimpleFIN Bridge's own site.
- [Default category list](issues/13-default-category-list.md) — 13 top-level categories, ~48 entries total with subcategories, mint.com-style; flags an open expense-vs-transfer type question for the domain model ticket.
- [Color theme tokens](issues/15-color-theme-tokens.md) — Full token set derived fresh from `#00D639` (not copied from Peppermint's palette); `success` deliberately hue-shifted 32° into teal so it doesn't read as a tint of primary; dark mode ruled out of scope for v1 but tokens kept as CSS custom properties for a later override block.
- [Domain model reconciliation](issues/16-domain-model-reconciliation.md) — Final shapes for Institution (normalized, keyed by SimpleFIN's `org_id`), Account (adds `AccountType` back as a user-set field, no SimpleFIN equivalent exists), Category (`CategoryType` extended with `'transfer'`), Transaction (SimpleFIN-vocabulary field names, no manual entry), Budget (unchanged from Peppermint — rollup generalization is a computation change, not a schema one), and CategorizationRule (narrower than old `Transformation`: category-matching only, no merchant-rename or exclusion memory).
- [Budget alert rules](issues/14-budget-alert-rules.md) — No badge/notification alerts for budgets (amends Notifications scope); status conveyed entirely via a three-state (normal/warning/over) progress-bar color, fixed 85% global warning threshold, Income categories invert the logic, rollover counts toward the percent-used calculation, and the bar shows a percentage with the dollar amount labeled above it. Period-closing UI deferred to Rollover engine generalization.
- [Rollover engine generalization](issues/17-rollover-engine-generalization.md) — Peppermint's carry-forward math (not its already-correct display rollup) gets a recursive rollup that stops at the first budgeted descendant, so an unbudgeted child's spend falls through to the nearest budgeted ancestor without double-counting a budgeted child's own envelope. Income categories are excluded from carry-forward entirely (target-vs-actual only, no rollover toggle). No schema changes. No dedicated period-closing UI — the rolled-over amount just shows as a labeled line on the Budget detail screen.
- [Key screens prototype](issues/18-key-screens-prototype.md) — Locked the "Card Stack" visual language across all 4 screens: full-bleed gradient hero bands (derived from the #15 tokens) with white cards overlapping the bottom edge, a matching gradient bottom nav that auto-hides on scroll, and large stat-carrying headers that scroll with the content (not pinned). Clickable prototype: [`assets/18-key-screens-prototype.html`](assets/18-key-screens-prototype.html).
- [Assemble the consolidated spec/architecture document](issues/19-assemble-final-spec.md) — **Destination reached.** All prior decisions assembled into one handoff document, [`19-spearmint-rebuild-spec.md`](assets/19-spearmint-rebuild-spec.md), including a suggested (non-binding) implementation phase breakdown. No new decisions made; this was the last open ticket.

## Not yet specified

*(none — the map is complete)*

## Out of scope

- Trends/graphs/charting — deferred, no charting feature this pass (see [Mobile IA & bottom nav](issues/06-mobile-ia-bottom-nav.md)).
- Push notifications — in-app badge only, no push infrastructure (see [Notifications scope](issues/08-notifications-scope.md)).
- Real-time multi-device sync — single-device app, manual export/import only (see [Backup & sync scope](issues/05-backup-sync-scope.md)).
- Migrating existing Spearmint data into the new schema — old database is dropped completely; the new app starts fresh (see [Persistence layer](issues/02-persistence-layer.md)).
- External merchant-classification service (Plaid Enrich, Ntropy, Akahu, MX) — surveyed and deferred as a possible future opt-in enhancement, not part of this v1 spec; none support safe browser-direct calls without a backend proxy (see [Auto-categorization approach](issues/12-auto-categorization-approach.md)).
- Dark mode — no dark palette defined this pass; tokens are CSS custom properties so a `[data-theme="dark"]` block can be added later without a rework (see [Color theme tokens](issues/15-color-theme-tokens.md)).
- Manual (non-SimpleFIN) transaction entry — nothing on this map asks for it and no surveyed source repo has it; Transaction is modeled as SimpleFIN-sourced only (see [Domain model reconciliation](issues/16-domain-model-reconciliation.md)).
