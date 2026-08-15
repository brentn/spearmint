# Budget status & rollup computation

Budget status is conveyed entirely through a three-state (normal/warning/over) progress-bar color — no separate notification (see [Notification scope](0007-notification-scope.md)). The warning threshold is a fixed 85%, global across categories; Income categories invert the over/under logic (going over target is good); a category's `Rollover` from the prior period counts toward its percent-used calculation.

Rollup is a full-tree recursive combine: every category's spent/amount/rollover always includes all of its descendants', regardless of whether those descendants have their own budget. A parent category with no explicit budget but at least one budgeted descendant gets a synthesized `Implied Budget` row. The Budgets screen's overall month total sums only top-level rows, real or implied, to avoid double-counting a child's spend under both its own row and its parent's.

This supersedes the original rebuild-era design, which stopped rollup at the first budgeted descendant specifically to avoid double-counting. That version shipped, then GitHub issue #15 replaced it with the current full-tree combine once the parent-only default view (issue #12) exposed a problem: a budgeted child with no budgeted parent would vanish from the default "Spending by category" list entirely, since no row existed for it to roll up into.
