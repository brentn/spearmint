# Uncategorized transactions in the income/expenses progress widget

The Overview screen and Budgets-hero income/expenses progress widget (issue #42) is the one place
in the app where an Uncategorized transaction (`categoryId === null`) counts toward a budget total.
Its two totals — combined income actual and combined expense actual — include uncategorized
transactions via a sign-of-amount heuristic (positive → income, negative → expense), skipping any
transaction flagged `excludeFromBudget`. The uncategorized portion renders as a dim/crosshatched
segment stacked onto the categorized solid segment, so it stays visually distinct without needing
its own text label.

Every other budget total in the app — each category's own row, `BudgetsAggregate.totalSpent`/
`earned`, the cash-flow chart — excludes uncategorized transactions entirely, unchanged from
before this issue. The progress widget's two totals are a deliberate, narrow exception: they exist
to answer "how much money moved this month, categorized or not" at a glance, not to correct the
per-category system, whose accuracy already depends on transactions actually being categorized.
