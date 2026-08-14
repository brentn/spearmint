Type: task
Status: resolved
Assignee: Brent Nesbitt
Blocked by: 10, 11, 12, 13, 14, 15, 16, 17, 18

## Question

Assemble the consolidated spec/architecture document — the actual destination of this map — from every resolved ticket: domain model, SimpleFIN access-layer design, auth/backup design, mobile IA, category taxonomy, rollover engine, auto-categorization approach, notification/alert rules, color theme, and links to the 4 key-screen prototypes. May include a suggested implementation phase/milestone breakdown as part of its content (not a separate map decision). This is what gets handed off to a follow-up implementation effort.

## Answer

Assembled as a single handoff document: [`19-spearmint-rebuild-spec.md`](../assets/19-spearmint-rebuild-spec.md). Ten sections — domain model, persistence, SimpleFIN access layer (incl. auto-categorization as §3.1), budgets & rollover engine, auth & backup, notifications, mobile IA (incl. category taxonomy as a subsection), visual design (theme tokens + the key-screens prototype), out of scope, and a suggested implementation phasing (offered as content within this document, not a separate map decision, per the map's Notes on keeping sequencing off the map itself).

No new decisions were made in the assembly — every section restates and cross-links back to its source ticket rather than re-deciding anything. One small consolidation: §7 folds the category-taxonomy tickets ([#07](07-category-taxonomy-approach.md), [#13](13-default-category-list.md)) in under Mobile IA ([#06](06-mobile-ia-bottom-nav.md)) as a subsection, since both shape the same Categories-adjacent surface area, rather than keeping IA and taxonomy in unrelated top-level sections.

This resolves the map's destination — every ticket blocking this one is closed, and this was the last open ticket. The map is complete; no further tickets are needed.
