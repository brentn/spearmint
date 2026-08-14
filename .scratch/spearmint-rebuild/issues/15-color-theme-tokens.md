Type: task
Status: resolved

## Question

Derive a full color theme token set with #00D639 as primary, in the style of Peppermint's `_peppermint.scss` (primary/accent/bg/surface/border/danger/warning/success/shadow tokens, both hex and CSS custom properties). Needs complementary accent, and danger/warning/success tones that read clearly alongside a saturated green primary (in particular, "success" can't just be a slightly different green from primary — needs real visual separation). Should also decide light vs dark surface treatment, or whether dark mode is out of scope for v1.

## Answer

Full token set below, in the Peppermint file's spirit (SCSS vars + mirrored CSS custom properties) but not its palette — Spearmint's `#00D639` is a fully-saturated neon green (HSL 136°, 100%, 42%), a very different starting point from Peppermint's muted teal (`#1ecb8b`, HSL 158°, 74%, 46%), so the supporting colors were derived fresh rather than reused.

```scss
// Spearmint Theme Variables
$spearmint-primary:        #00D639;   // HSL 136°, 100%, 42%
$spearmint-primary-rgb:    0, 214, 57;
$spearmint-accent:         #699ABF;   // muted blue, HSL 206°, 40%, 58% — links/icons/secondary UI
$spearmint-bg:              #F9FBFA;
$spearmint-surface:        #FFFFFF;
$spearmint-border:         #DDE4DF;
$spearmint-danger:         #DF2030;   // HSL 355°, 75%, 50%
$spearmint-warning:        #FFB029;   // HSL 38°, 100%, 58%
$spearmint-success:        #137C67;   // deep teal-green, HSL 168°, 74%, 28% — see rationale below
$spearmint-ink:             #15251B;   // near-black w/ a green cast, primary text color
$spearmint-on-primary:     #15251B;   // text/icon color when sitting ON primary — see contrast note
$spearmint-on-accent:      #FFFFFF;
$spearmint-overlay:        rgba(21, 37, 27, 0.45);
$spearmint-shadow:         0 2px 8px rgba(21, 37, 27, 0.10);
$spearmint-shadow-strong:  0 4px 16px rgba(21, 37, 27, 0.18);
$spearmint-radius:         14px;
$spearmint-font-family:    'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;

:root {
    --spearmint-primary: #00D639;
    --spearmint-primary-rgb: 0, 214, 57;
    --spearmint-accent: #699ABF;
    --spearmint-bg: #F9FBFA;
    --spearmint-surface: #FFFFFF;
    --spearmint-border: #DDE4DF;
    --spearmint-danger: #DF2030;
    --spearmint-warning: #FFB029;
    --spearmint-success: #137C67;
    --spearmint-ink: #15251B;
    --spearmint-on-primary: #15251B;
    --spearmint-on-accent: #FFFFFF;
    --spearmint-overlay: rgba(21, 37, 27, 0.45);
    --spearmint-shadow: 0 2px 8px rgba(21, 37, 27, 0.10);
    --spearmint-shadow-strong: 0 4px 16px rgba(21, 37, 27, 0.18);
    --spearmint-radius: 14px;
    --spearmint-font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
}
```

**Why `success` isn't just a lighter/darker primary green:** the failure mode named in the question is real in Peppermint's own file — its `$peppermint-success` (`#43d19e`) sits at the *same hue* (158°) as its primary, differing only in lightness/saturation, so a success toast and a plain brand-colored surface read as the same color at a glance. `#00D639` is a fully-saturated 136° green, so anything else in the 120–150° range fused with it visually. `$spearmint-success` (`#137C67`) is pushed 32° around the wheel into teal territory and dropped to ~28% lightness — dark and blue-shifted enough to read as a distinct color, not a tint of the primary, while staying in the "green = good" semantic family. Side-by-side with `$spearmint-primary` it reads as forest-teal vs. neon-lime, not two shades of the same green.

**Contrast (WCAG 2.1), computed, not eyeballed:**
- `primary` vs. white text: **1.97** — fails. Neon green is too light-luminance for white text. Text/icons placed *on* primary must use `$spearmint-on-primary` (`#15251B`, dark ink), which gets **8.3:1**.
- `danger` vs. white text: **4.79** — passes AA (4.5:1) for normal text.
- `warning` vs. white text: **1.83** — fails; `warning` follows the same on-color pattern as `primary` and takes dark ink text (**8.9:1**), not white.
- `success` vs. white text: **5.11** — passes AA.
- `accent` vs. white text: **3.01** — passes the 3:1 bar for large text/UI components (borders, icons, links) but not small body text; scoped accordingly to non-text UI use, not solid-fill button labels.
- `ink` vs. `bg`: **15.7:1** — body text has large headroom.

**Light vs. dark mode:** out of scope for v1. This is a from-scratch single-device app with no existing dark-mode users to preserve, and no other ticket on this map calls for it. Tokens are still expressed as CSS custom properties (not hardcoded in components) specifically so a `[data-theme="dark"]` override block is a follow-up addition later, not a rework — but defining that second palette now would be scope creep on a ticket about the primary color.

