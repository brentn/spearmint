# Bottom-nav overlay positioning instead of a reserved flex row

Follow-up to ADR 0019. That fix stopped the nav's box size from changing when it hides/shows,
but kept the nav as a flex sibling of `.app-scroll` with a permanently reserved row — so hiding
the nav revealed a blank strip of `.app-shell`'s own background, not the content underneath it,
for as long as it stayed hidden. Live testing showed this reads as wasted space, not a fixed nav.

## Decision

Make `.nav-shell` `position: absolute`, anchored to `.app-shell` (its nearest positioned
ancestor) rather than a flex sibling of `.app-scroll`. This is not `position: fixed` — it
resolves against a normal in-flow block, not the browser's visual viewport, so ADR 0012's reason
for rejecting `fixed` (iOS Safari's chrome-animation compensation) doesn't apply here.

With the nav removed from the flex flow, `.app-scroll` (now the only flex child of `.app-shell`)
expands to the full screen height, always. `.app-content` gets a `padding-bottom` equal to the
nav's height (`--spearmint-nav-height`, a token shared with `nav-shell.scss` — see
`_tokens.scss` — so the two can't drift out of sync) so real content never renders underneath the
nav while it's visible.

Net effect: hiding the nav now uncovers actual content for the full length of a scroll, not just
a blank strip at the very bottom of the screen. The `.app-content` padding is still a fixed
reservation at the true end of a scroll (same tradeoff ADR 0014 accepted, for the same reason:
the nav still auto-shows near the bottom, so something has to keep the last item from sitting
behind it there) — but that cost no longer applies everywhere else on the page.
