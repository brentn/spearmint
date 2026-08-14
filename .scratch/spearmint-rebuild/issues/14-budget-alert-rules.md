Type: grilling
Status: resolved

## Question

Per [Notifications scope](08-notifications-scope.md), budget-related alerts are in scope but not yet specified. What exactly triggers a budget alert (e.g. crossing 80%/100% of a category's budget, a category going negative, a rollover period closing)? Are thresholds global or configurable per category? What does the alert say?

## Answer

**No badge/notification alerts for budgets at all.** This amends [Notifications scope](08-notifications-scope.md) — its badge triggers are now auth issues and errors only; budget alerts is dropped as a trigger there.

Budget status is instead conveyed entirely via **progress-bar color**, three states: normal (green) / warning (amber) / over (red).

- **Warning threshold is a fixed 85%** globally — not configurable per category.
- **Expense categories**: green below 85%, amber 85–100%, red at 100%+.
- **Income categories invert the logic** (Income budgets track a target to meet/exceed, not a ceiling to stay under): green at/above target, amber approaching from below, red well under target.
- **Rollover counts toward available budget** for the percent calculation: `percent = spent ÷ (amount + rolloverAmount)`.
- **Label layout**: the dollar amount of the budget is shown in small text above the bar; the bar itself shows a single percentage number.
- **Period-closing UI is fully deferred** to [Rollover engine generalization](17-rollover-engine-generalization.md) — not decided here.
