# Bottom-nav auto-hide via non-reflowing transform and a scroll dead zone

Supersedes ADR 0014. The box-collapse hide mechanism (`max-height`/padding transitioning to
zero so `.app-scroll` reflows to reclaim the space, plus a `ResizeObserver` and settle-debounce
in `NavShell` to compensate for that reflow perturbing the scroll container mid-transition) kept
layering fixes on itself without resolving the underlying bugs: rapid open/close near the page
bottom, rapid open/close during slow scrolling, and the nav visibly "grabbing the page" and
scrolling it to the end mid-reveal (GitHub issue #43).

Root cause: collapsing the nav's own box size changes `.app-scroll`'s `clientHeight` while a
scroll is in progress, feeding synthetic scroll events back into the direction-based hide/reveal
logic. ADR 0014's near-bottom margin (sized from the nav's live-measured height) was a mitigation
for this, not a fix — the feedback loop was still there for any scroll that wasn't near the
bottom.

## Decision

- **Hide via `transform: translateY(100%)` instead of a box-size collapse.** The nav keeps a
  permanently reserved row in `.app-shell`'s flex column (ADR 0012's scroll-container attachment
  is unchanged); hiding it is now purely visual and never changes `.app-scroll`'s `clientHeight`.
  This removes the reflow-during-scroll feedback loop at its root, and removes the need for
  `NavShell` to measure or report its own height at all — `translateY(100%)` moves the element by
  its own rendered height automatically.
- **Near-bottom threshold is a plain constant (8px)**, no longer derived from the nav's height —
  that derivation existed only to size a margin wide enough to absorb the box-collapse reflow,
  which no longer happens.
- **A 24px scroll-distance dead zone**, accumulated in the current direction and reset on any
  direction reversal, gates the hidden/visible toggle. This absorbs the small back-and-forth
  deltas that momentum and rubber-band scrolling generate, which is what caused rapid open/close
  during slow scrolling.
- Velocity-coupled transition duration (matching animation speed to scroll speed) was considered
  and explicitly dropped as not worth the added state and edge cases for a cosmetic effect.

Tradeoff accepted: hiding the nav no longer reclaims its screen space for `.app-scroll` — the
row stays reserved, just visually empty. Issue #43 didn't ask for that space back, only for the
hide/show behavior itself to stop misbehaving.
