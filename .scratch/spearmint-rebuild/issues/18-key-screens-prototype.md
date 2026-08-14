Type: prototype
Status: resolved
Blocked by: 15

## Question

Per [UI design & prototype scope](01-ui-design-prototype-scope.md), build clickable HTML/CSS prototypes (via `/prototype`) of: Overview/dashboard, Budget detail (progress-bar treatment, over/under-budget states), Transaction list, and the bottom-nav shell (tabs per [#06](06-mobile-ia-bottom-nav.md)). Use the color tokens from [#15](15-color-theme-tokens.md). React against mint.com's mobile look and feel.

## Answer

Built via `/prototype` (UI sub-shape B — no real app yet to host it in) as a single clickable static HTML/CSS/JS mini-app, linked asset: [`assets/18-key-screens-prototype.html`](../assets/18-key-screens-prototype.html). Three structurally different treatments (Card Stack / Compact List / Sectioned Minimal) were built and compared; **Card Stack won** and was then iterated on against two mint.com reference screenshots the user supplied.

**Locked visual language, all 4 screens:**
- A full-bleed (edge-to-edge, no side gutters) gradient hero band — `linear-gradient(165deg, #0D2A20 → #0F5E44 → #12A85A → #00D639)`, derived from the locked primary/success tokens ([#15](15-color-theme-tokens.md)), not a copied palette — tops every screen, with white rounded cards floating over its bottom edge (negative-margin overlap).
- The bottom nav (4 tabs per [#06](06-mobile-ia-bottom-nav.md)) carries the same gradient; inactive tab labels are translucent white for legibility, active tab keeps the primary-green pill with dark-ink icon per [#15](15-color-theme-tokens.md)'s contrast rule. The nav auto-hides on scroll-down and reveals on scroll-up/near-top.
- Headers **scroll with the content** (not pinned) on all 4 screens — chosen over a fixed header because the overlap-card motif only reads correctly as part of normal document flow; a pinned header would fight it. Applied consistently rather than mixed per-screen.
- Each header carries a real stat, not just a title: Overview shows total balance + a plain-text month-over-month delta (explicitly *not* a line chart — Trends/graphs stayed out of scope per [#06](06-mobile-ia-bottom-nav.md)/map's Out of scope); Budgets shows total spent-of-budgeted + an encouragement line, sized large (~1/3 of the screen); Transactions shows total spent this month + transaction count; Settings shows a plain headline.
- Overview's account summary is two type-aggregated total cards (Cash / Credit cards, filterable via pills) rather than a per-account list — individual accounts (incl. the `needsReconnect` flag) stay on Settings; a bell icon with a badge dot surfaces the reconnect signal from Overview per [#08](08-notifications-scope.md)'s in-app-badge-only rule.
- Budget detail and the Budgets-tab progress bars implement [#14](14-budget-alert-rules.md)'s three-state coloring (including the income-inverted case) exactly, dollar amount above / percentage in the bar; the Budgets-tab aggregate bar additionally gets a "▲ Today" tick at the elapsed-day-of-month mark. The rollover pill ("+ $X rolled over from last month," [#17](17-rollover-engine-generalization.md)) appears on Budget Detail only when `rolloverAmount > 0`.
- A cash-flow (Earned vs. Spent) two-bar comparison sits on the Budgets tab, built from reference-image inspiration; it's a static aggregate comparison, not a time series, so it wasn't treated as reopening the Trends/graphs out-of-scope call — flagged to the user, who confirmed it was fine.

No schema or scope changes — this is a pure visual-design answer, consistent with everything already locked elsewhere on the map.
