Type: task
Status: resolved
Blocked by: 16

## Question

Generalize Peppermint's rollover-budget engine (`budgets.service.ts`'s `recomputeRolloversInMemory`, which versions a Budget per {categoryId, periodType, period} and computes `rolloverAmount = max(0, previousAvailable - previousActual)`) so a parent category's budget also rolls up its children's actual spend — a requirement stated in both prior apps' specs but never built in either. Define the exact rollup formula when a parent has its own budget AND budgeted children, and when income categories are involved.

## Answer

**The gap is narrower than it first looks — only the carry-forward math is missing rollup, not display.** Peppermint already has two separate rollup mechanisms and only one of them has the gap:

1. **Display rollup** (`budget-summary.util.ts`'s `buildBudgetBranchRows`) already sums `budgetAmount`/`rolloverAmount`/`actualAmount` bottom-up across a whole branch for a given period's snapshot — a parent row's totals already include every descendant's numbers, unconditionally. This is correct as-is and needs **no change**.
2. **Carry-forward rollup** (`budgets.service.ts`'s `recomputeRolloversInMemory`) computes `previousActualAmount` via `getMonthlyActualAmount`, which only sums a category's own *direct* transactions (`transaction.categoryId === categoryId`, exact match, no descendants). If a parent like "Housing" is budgeted but every transaction actually lands on its children ("Rent", "Utilities"), Housing's `previousActualAmount` is always 0, so its entire budget rolls over untouched every month regardless of real spend. **This is the gap the ticket is about.**

### Rollup rule (for carry-forward only)

Replace the direct-lookup `getMonthlyActualAmount(actualsByPeriodAndCategory, previousPeriod, categoryId)` call inside `recomputeRolloversInMemory` with a recursive rollup that **stops at the first budgeted descendant** — an unbudgeted child's spend falls through to the nearest budgeted ancestor; a budgeted child manages its own envelope and is never double-counted into a parent's:

```ts
private getRollupActualAmount(
    period: YearMonth,
    categoryId: string,
    categories: Category[],
    actualsByPeriodAndCategory: Map<string, number>,
    budgets: Budget[]
): number {
    const direct = this.getMonthlyActualAmount(actualsByPeriodAndCategory, period, categoryId);
    const children = categories.filter((c) => c.parentCategoryId === categoryId);

    const childContribution = children.reduce((sum, child) => {
        const childIsBudgetedThisPeriod = this.getEffectiveBudgetForScope(budgets, child.id, 'month', period) !== null;

        return sum + (childIsBudgetedThisPeriod
            ? 0  // child manages its own envelope — already carried in its own rollover chain, not double-counted here
            : this.getRollupActualAmount(period, child.id, categories, actualsByPeriodAndCategory, budgets));
    }, 0);

    return direct + childContribution;
}
```

Key subtlety: "budgeted" is checked via `getEffectiveBudgetForScope(..., previousPeriod)` — the same *effective-as-of-that-period* lookup the engine already uses elsewhere — not "has a budget ever." A child that only started being budgeted last month still had its earlier months' spend roll up into the parent; the moment its own budget takes effect, its spend stops flowing up.

Only this one call site changes; nothing else in `recomputeRolloversInMemory`'s loop structure, `ensureBudgetVersionForPeriod`, or the display path moves.

### Income categories: excluded from carry-forward entirely

**Decision: `rollOver`/rollover-carry does not apply to `'income'`-typed budgets at all.** The `max(0, previousAvailable - previousActual)` formula reads as "unused budget carries forward" for spend envelopes, but applied to income it would mean "an income shortfall raises next period's income target" — not a coherent operation, and nothing on this map (including [Category taxonomy approach](07-category-taxonomy-approach.md)'s "Income has its own budget treatment") specifies what that treatment should be beyond target-vs-actual tracking. Resolution: `scopeCategoryIds` in `recomputeRolloversInMemory` is filtered to categories whose `Category.type` is `'expense'` or `'transfer'` only (both are spend-style envelopes and participate in rollup identically); `'income'`-typed budgets are compared target-vs-actual per period with no carry, same as before this ticket, and the UI should not offer a rollover toggle on an Income budget. This is a one-line filter added alongside the existing `periodType === 'month'` filter — no schema change, since `Budget` doesn't need to know category type itself (the filter joins through `categoriesService.getCategoryById(categoryId).type` at filter time).

### No schema changes

Confirms what [Domain model reconciliation](16-domain-model-reconciliation.md) already stated: this is purely a computation change inside the rollover engine. `Budget` and `Category` keep the shapes locked there.

### Period-closing UI (deferred here from [Budget alert rules](14-budget-alert-rules.md))

**No dedicated "period closed" moment — no modal, toast, or badge.** [Budget alert rules](14-budget-alert-rules.md) already ruled out any notification/badge trigger for budgets, so a separate closing ceremony would be the one place on this map introducing alert-like UI through the back door. Instead, the carried-over amount is simply visible as ordinary state the next time the user looks: the Budget detail screen (already in scope for [Key screens prototype](18-key-screens-prototype.md)) shows a labeled line — **"+$X rolled over from last month"** — above the progress bar whenever `rolloverAmount > 0` for the current period's effective budget, using the same rollup-aware `rolloverAmount` this ticket computes. Nothing closes or transitions in the UI; the number is just there, computed lazily by `reconcileCurrentMonthRollovers()` on read (as Peppermint's engine already does) rather than on any explicit "close the period" action.
