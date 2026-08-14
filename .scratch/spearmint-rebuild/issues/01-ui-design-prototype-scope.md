Type: grilling
Status: resolved

## Question

Does this map's destination include locking visual/UI design (screen layouts, component-level look), or does it stay at the architecture/feature level and leave pixel-level design to implementation? If UI design is in scope, how should it get locked down — written style guide, interactive prototype, or both?

## Answer

UI design is in scope. It gets locked down via **interactive HTML/CSS prototypes** (built with the `/prototype` skill), not a written style guide alone — "looks like mint.com" is a feel that can only be validated by reacting to an actual rendered screen.

Scope: prototype the 4 screens that carry the most visual identity —
1. Overview/dashboard (account summary + budget progress bars)
2. Budget detail (the progress-bar treatment itself, over/under-budget states)
3. Transaction list
4. Bottom nav shell (the 4-tab structure from [Mobile IA & bottom nav](06-mobile-ia-bottom-nav.md))

The prototype ticket ([#18](18-key-screens-prototype.md)) depends on the color theme tokens being derived first ([#15](15-color-theme-tokens.md)).
