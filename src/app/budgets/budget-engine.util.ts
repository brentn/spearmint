import type { Budget, Category, CategoryType, PeriodType, Transaction, YearMonth } from '../data/models';
import { nextYearMonth, previousYearMonth } from './period.util';

/**
 * The rollover engine. `Transaction.amount` follows SimpleFIN's "positive = deposit"
 * convention, so expense/transfer spend arrives as negative numbers and must be negated
 * to get a positive "amount spent" for budget math.
 */

const EXPENSE_WARNING_THRESHOLD = 1.01;
const EXPENSE_OVER_THRESHOLD = 1.1;
const INCOME_WARNING_THRESHOLD = 0.7;
/** A reversed (negative-total) bar is capped short of full width — a -100% reversed bar would
 * otherwise be pixel-identical to a +100% forward one, since a fully-filled track shows no bare
 * pixel to reveal which edge it grew from. The gap this leaves is also where the overflow
 * chevron/label render once the true magnitude exceeds it. */
const REVERSED_CAP = 0.9;

/** 'info' is a presentation-only override applied above this engine (BudgetsStore) for income
 * rows before the final week of the month (issue #21) — never produced by computeBudgetStatus. */
export type BudgetState = 'normal' | 'warning' | 'over' | 'info';

export interface BudgetStatus {
  /** (spent − rolloverAmount) / amount — uncapped, can exceed 1. The bar's capacity is always
   * this period's own `amount`; a rollover deficit shows up as pre-spent progress instead of
   * shrinking the bar, and a rollover credit can push progress negative (reversed fill). */
  percent: number;
  /** `percent` clamped to [0, 1] (or its magnitude, clamped to [0, 1], when `reversed`), for
   * rendering bar fill width. */
  barPercent: number;
  /** True when `percent` is negative — e.g. a refund/reversal pushed the category's actual past
   * zero the other way. The bar should fill from the opposite edge in this case; `state`'s color
   * already lands correctly (green for expense, red for income) with no change needed there. */
  reversed: boolean;
  /** True when a reversed bar's true magnitude exceeds the `REVERSED_CAP` it renders at — the bar
   * itself can no longer show "how far past the cap", so the UI shows a directional chevron (and
   * moves the percentage label next to it) instead. Always false when `reversed` is false. */
  reversedCapped: boolean;
  state: BudgetState;
}

/**
 * Sums transaction amounts per `${period}:${categoryId}`, signed so the result is always
 * "positive = more of what that category type cares about": spend for expense/transfer,
 * earned for income. Transactions with no category or flagged `excludeFromBudget` are
 * skipped, matching that field's purpose (carried forward from old Spearmint's
 * `hideFromBudget`).
 */
export function buildSignedActualsMap(transactions: Transaction[], categories: Category[]): Map<string, number> {
  const categoryTypeById = new Map(categories.map((c) => [c.id, c.type]));
  const map = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.categoryId === null || transaction.excludeFromBudget) {
      continue;
    }
    const type = categoryTypeById.get(transaction.categoryId);
    if (type === undefined) {
      continue;
    }
    const period = transaction.date.slice(0, 7);
    const signedAmount = type === 'income' ? transaction.amount : -transaction.amount;
    const key = `${period}:${transaction.categoryId}`;
    map.set(key, (map.get(key) ?? 0) + signedAmount);
  }

  return map;
}

export function getBudgetForExactPeriod(
  budgets: Budget[],
  categoryId: string,
  periodType: PeriodType,
  period: YearMonth,
): Budget | null {
  return (
    budgets.find((b) => b.categoryId === categoryId && b.periodType === periodType && b.period === period) ?? null
  );
}

/** Most recent budget at or before `period` for this category/periodType scope. */
export function getEffectiveBudgetForScope(
  budgets: Budget[],
  categoryId: string,
  periodType: PeriodType,
  period: YearMonth,
): Budget | null {
  const candidate = budgets
    .filter((b) => b.categoryId === categoryId && b.periodType === periodType && b.period <= period)
    .sort((a, b) => b.period.localeCompare(a.period))[0];
  return candidate ?? null;
}

/**
 * Carry-forward rollup fix (spec §4): a budgeted parent's actual spend includes unbudgeted
 * descendants' spend, stopping at the first budgeted descendant so a budgeted child's own
 * envelope is never double-counted into its parent's. "Budgeted" is the effective-as-of-that-
 * period lookup, not "has a budget ever".
 */
export function getRollupActualAmount(
  period: YearMonth,
  categoryId: string,
  categories: Category[],
  actualsByPeriodAndCategory: Map<string, number>,
  budgets: Budget[],
): number {
  const direct = actualsByPeriodAndCategory.get(`${period}:${categoryId}`) ?? 0;
  const children = categories.filter((c) => c.parentCategoryId === categoryId);

  const childContribution = children.reduce((sum, child) => {
    const childIsBudgetedThisPeriod = getEffectiveBudgetForScope(budgets, child.id, 'month', period) !== null;

    return (
      sum +
      (childIsBudgetedThisPeriod
        ? 0 // child manages its own envelope — already carried in its own rollover chain
        : getRollupActualAmount(period, child.id, categories, actualsByPeriodAndCategory, budgets))
    );
  }, 0);

  return direct + childContribution;
}

/** All descendants of `categoryId` at any depth (children, grandchildren, ...), generic
 * over the category-management UI's current two-level cap so the rollup math below never
 * hard-codes "just look at children". */
export function getDescendantCategories(categoryId: string, categories: Category[]): Category[] {
  const children = categories.filter((c) => c.parentCategoryId === categoryId);
  return children.flatMap((child) => [child, ...getDescendantCategories(child.id, categories)]);
}

/**
 * Full-subtree actual amount (issue #15's unified rollup rule): unlike `getRollupActualAmount`
 * (which stops at a budgeted descendant for the rollover engine's own-envelope math), this
 * always includes every descendant's spend regardless of whether that descendant has its own
 * budget — the basis for a combined row's displayed `spent`.
 */
export function getCombinedActualAmount(
  period: YearMonth,
  categoryId: string,
  categories: Category[],
  actualsByPeriodAndCategory: Map<string, number>,
): number {
  const direct = actualsByPeriodAndCategory.get(`${period}:${categoryId}`) ?? 0;
  const descendants = getDescendantCategories(categoryId, categories);
  const descendantContribution = descendants.reduce(
    (sum, descendant) => sum + (actualsByPeriodAndCategory.get(`${period}:${descendant.id}`) ?? 0),
    0,
  );
  return direct + descendantContribution;
}

export interface CombinedBudgetAmounts {
  /** Own explicit amount (0 if none) plus every budgeted descendant's own amount. */
  amount: number;
  /** Own explicit rolloverAmount (0 if none) plus every budgeted descendant's own rolloverAmount. */
  rolloverAmount: number;
  /** Whether this category has its own explicit budget for `period` (vs. only implied via descendants). */
  hasOwnBudget: boolean;
  /** Whether any descendant (any depth) has its own explicit budget for `period`. */
  hasBudgetedDescendant: boolean;
}

/**
 * Issue #15's unified amount rule: a category's effective budgeted amount/rollover is its own
 * explicit budget's amount/rollover (zero if it has none) plus the sum of all its *budgeted*
 * descendants' own amount/rollover, recursively. Used for both real rows (own budget present)
 * and implied rows (own budget absent, `hasBudgetedDescendant` true) — the same formula degrades
 * to "just its own budget" for a leaf category, matching pre-#15 behavior exactly.
 */
export function getCombinedBudgetAmounts(
  categoryId: string,
  categories: Category[],
  budgets: Budget[],
  period: YearMonth,
): CombinedBudgetAmounts {
  const ownBudget = getEffectiveBudgetForScope(budgets, categoryId, 'month', period);
  const descendants = getDescendantCategories(categoryId, categories);

  let amount = ownBudget?.amount ?? 0;
  let rolloverAmount = ownBudget?.rolloverAmount ?? 0;
  let hasBudgetedDescendant = false;

  for (const descendant of descendants) {
    const descendantBudget = getEffectiveBudgetForScope(budgets, descendant.id, 'month', period);
    if (descendantBudget) {
      amount += descendantBudget.amount;
      rolloverAmount += descendantBudget.rolloverAmount ?? 0;
      hasBudgetedDescendant = true;
    }
  }

  return { amount, rolloverAmount, hasOwnBudget: ownBudget !== null, hasBudgetedDescendant };
}

/**
 * Three-state progress status: expense/transfer categories are green up to and including 101%
 * of budget, amber from there through 110%, red beyond that — a small overspend cushion before
 * the bar turns alarming. Income is inverted (a target to meet/exceed, unaffected by the expense
 * thresholds above). The bar's capacity is always this period's own `amount` — never adjusted by
 * rollover; instead a rollover deficit (`rolloverAmount < 0`) is added into `spent` as if already
 * spent, and a rollover credit (`rolloverAmount > 0`) is subtracted, which can push `percent`
 * negative and reuses the reversed-bar rendering below. A $0-budget row has no meaningful percent
 * to bucket (nothing to divide by): positive spend stays red per the existing $0-budget convention
 * (issue #21) via an explicit state override below; negative spend (a refund/reversal with no
 * budget at all) still reverses at full magnitude rather than the two effectively canceling out
 * to an invisible 0%.
 */
export function computeBudgetStatus(
  categoryType: CategoryType,
  spent: number,
  amount: number,
  rolloverAmount: number,
): BudgetStatus {
  const progress = spent - rolloverAmount;
  const percent = amount > 0 ? progress / amount : progress > 0 ? 1 : progress < 0 ? -1 : 0;
  const reversed = percent < 0;
  const reversedCapped = reversed && Math.abs(percent) > REVERSED_CAP;
  const barPercent = reversed
    ? Math.min(REVERSED_CAP, Math.abs(percent))
    : Math.max(0, Math.min(1, percent));

  let state: BudgetState;
  if (categoryType === 'income') {
    if (percent >= 1) {
      state = 'normal';
    } else if (percent >= INCOME_WARNING_THRESHOLD) {
      state = 'warning';
    } else {
      state = 'over';
    }
  } else if (amount <= 0 && progress > 0) {
    // No "% over" to land on when there's nothing budgeted at all — stays red per the existing
    // $0-budget convention (issue #21) regardless of where percent (hard-coded to 1) would
    // otherwise fall among the thresholds below.
    state = 'over';
  } else {
    if (percent <= EXPENSE_WARNING_THRESHOLD) {
      state = 'normal';
    } else if (percent <= EXPENSE_OVER_THRESHOLD) {
      state = 'warning';
    } else {
      state = 'over';
    }
  }

  return { percent, barPercent, reversed, reversedCapped, state };
}

export interface UncategorizedTotals {
  /** Sum of uncategorized (`categoryId === null`) positive-amount transactions for the period. */
  income: number;
  /** Sum of uncategorized negative-amount transactions for the period, negated to a positive spend. */
  expenses: number;
}

/**
 * Sums uncategorized transactions for `period` via a sign-of-amount heuristic — positive
 * counts as income, negative as expense — skipping any flagged `excludeFromBudget`. Scoped to
 * the income/expenses progress widget's two totals only (issue #42); every other budget total
 * in the app (row spend, `BudgetsAggregate.totalSpent`/`earned`) excludes uncategorized
 * transactions entirely (see ADR-0018).
 */
export function computeUncategorizedTotals(transactions: Transaction[], period: YearMonth): UncategorizedTotals {
  let income = 0;
  let expenses = 0;

  for (const transaction of transactions) {
    if (
      transaction.categoryId !== null ||
      transaction.excludeFromBudget ||
      transaction.date.slice(0, 7) !== period
    ) {
      continue;
    }
    if (transaction.amount > 0) {
      income += transaction.amount;
    } else if (transaction.amount < 0) {
      expenses += -transaction.amount;
    }
  }

  return { income, expenses };
}

export interface FlowProgressRow {
  /** Categorized actual — already excludes uncategorized transactions (unchanged elsewhere). */
  categorizedActual: number;
  /** Uncategorized actual, via computeUncategorizedTotals' sign heuristic. */
  uncategorizedActual: number;
  /** categorizedActual + uncategorizedActual — the bar's combined fill total. */
  totalActual: number;
  budget: number;
  /** Fraction of the track this row's bar should fill — 1 (full width) when `budget` is 0,
   * unless `reversed`, which keeps its own lower cap regardless of `zeroBudget`. */
  barPercent: number;
  /** Income is always 'info' (blue) regardless of percent — a fixed color, not a judgment on
   * progress toward target (unlike the per-category income row's pre-final-week 'info' state). */
  state: BudgetState;
  /** True when the combined actual went negative — the bar fills from the opposite edge.
   * Direction only; color is unaffected (income stays 'info' either way). */
  reversed: boolean;
  /** True when a reversed bar's true magnitude exceeds the rendering cap — see `BudgetStatus.reversedCapped`. */
  reversedCapped: boolean;
  /** True when `budget` is 0 — the view renders actual-only text instead of "$actual of $budget". */
  zeroBudget: boolean;
}

export interface FlowProgressViewModel {
  income: FlowProgressRow;
  expenses: FlowProgressRow;
}

/**
 * Builds one row (income or expenses) of the income/expenses progress widget (issue #42).
 * Income always renders blue ('info'); expenses use computeBudgetStatus's normal/warning/over
 * three-state, both against the *combined* (categorized + uncategorized) actual so the bar's
 * color matches what it visually fills.
 */
export function buildFlowProgressRow(
  categoryType: 'income' | 'expense',
  categorizedActual: number,
  uncategorizedActual: number,
  budget: number,
): FlowProgressRow {
  const totalActual = categorizedActual + uncategorizedActual;
  const zeroBudget = budget === 0;
  const status = computeBudgetStatus(categoryType, totalActual, budget, 0);

  return {
    categorizedActual,
    uncategorizedActual,
    totalActual,
    budget,
    // A reversed bar must keep its cap even for a zero-budget row — forcing it to a full 1 here
    // like the forward case would recreate the exact "looks identical either direction" bug.
    barPercent: zeroBudget && !status.reversed ? 1 : status.barPercent,
    state: categoryType === 'income' ? 'info' : status.state,
    reversed: status.reversed,
    reversedCapped: status.reversedCapped,
    zeroBudget,
  };
}

export interface RecomputeRolloversResult {
  /** Every budget after reconciliation — existing rows (possibly mutated) plus new ones. */
  budgets: Budget[];
  /** Ids of pre-existing budgets whose `rolloverAmount` changed (persist via update). */
  changedBudgetIds: Set<string>;
  /** Brand-new period-version rows created to carry a rollover forward (persist via insert). */
  createdBudgets: Budget[];
}

/**
 * Recomputes `rolloverAmount` for every rollOver-enabled, monthly, non-income budget from
 * the earliest such budget's period through `currentPeriod`. Walking from the earliest
 * period (not just one step back) means a gap of several unopened months still compounds
 * correctly in a single call — "the rolled-over amount is just visible state on next read"
 * has to hold no matter how long between reads.
 *
 * Signed: an overspent month carries a negative `rolloverAmount` into the next one (no
 * floor at zero) rather than only ever carrying forward unused budget.
 *
 * A period whose `rolloverManual` flag is set was hand-edited by the user and is never
 * recomputed here — its stored `rolloverAmount` is left exactly as-is, but still read as
 * the starting point (`previousAvailable`) when computing the period after it, so a manual
 * correction propagates forward exactly like an auto-computed one would.
 */
export function recomputeRollovers(
  budgets: Budget[],
  transactions: Transaction[],
  categories: Category[],
  currentPeriod: YearMonth,
  createId: () => string = () => globalThis.crypto.randomUUID(),
): RecomputeRolloversResult {
  const categoryTypeById = new Map(categories.map((c) => [c.id, c.type]));
  const monthlyCategoryIds = [...new Set(budgets.filter((b) => b.periodType === 'month').map((b) => b.categoryId))];
  // Income categories are excluded from carry-forward entirely (spec §4) — target-vs-actual only.
  const scopeCategoryIds = monthlyCategoryIds.filter((id) => categoryTypeById.get(id) !== 'income');

  const workingBudgets: Budget[] = budgets.map((b) => ({ ...b }));
  const changedBudgetIds = new Set<string>();
  const createdBudgets: Budget[] = [];
  const createdIds = new Set<string>();

  if (scopeCategoryIds.length === 0) {
    return { budgets: workingBudgets, changedBudgetIds, createdBudgets };
  }

  const startPeriod = workingBudgets
    .filter((b) => b.periodType === 'month' && scopeCategoryIds.includes(b.categoryId))
    .map((b) => b.period)
    .sort()[0];

  if (startPeriod === undefined || startPeriod > currentPeriod) {
    return { budgets: workingBudgets, changedBudgetIds, createdBudgets };
  }

  const actualsByPeriodAndCategory = buildSignedActualsMap(transactions, categories);
  let periodCursor = startPeriod;

  while (periodCursor <= currentPeriod) {
    const previousPeriod = previousYearMonth(periodCursor);

    for (const categoryId of scopeCategoryIds) {
      const previousEffectiveBudget = getEffectiveBudgetForScope(workingBudgets, categoryId, 'month', previousPeriod);
      const existingCurrent = getBudgetForExactPeriod(workingBudgets, categoryId, 'month', periodCursor);

      if (existingCurrent !== null && existingCurrent.rolloverManual) {
        // Hand-edited — never recomputed, but its stored value still feeds the next period
        // forward via `previousEffectiveBudget` on the next loop iteration.
        continue;
      }

      if (previousEffectiveBudget === null || !previousEffectiveBudget.rollOver) {
        if (existingCurrent !== null && (existingCurrent.rolloverAmount ?? 0) !== 0) {
          existingCurrent.rolloverAmount = 0;
          if (!createdIds.has(existingCurrent.id)) {
            changedBudgetIds.add(existingCurrent.id);
          }
        }
        continue;
      }

      const previousAvailable = previousEffectiveBudget.amount + (previousEffectiveBudget.rolloverAmount ?? 0);
      const previousActual = getRollupActualAmount(
        previousPeriod,
        categoryId,
        categories,
        actualsByPeriodAndCategory,
        workingBudgets,
      );
      const nextRolloverAmount = previousAvailable - previousActual;

      let currentPeriodBudget = existingCurrent;
      if (currentPeriodBudget === null) {
        currentPeriodBudget = {
          id: createId(),
          categoryId,
          periodType: 'month',
          period: periodCursor,
          rollOver: previousEffectiveBudget.rollOver,
          rolloverAmount: 0,
          amount: previousEffectiveBudget.amount,
        };
        workingBudgets.push(currentPeriodBudget);
        createdBudgets.push(currentPeriodBudget);
        createdIds.add(currentPeriodBudget.id);
      }

      if ((currentPeriodBudget.rolloverAmount ?? 0) !== nextRolloverAmount) {
        currentPeriodBudget.rolloverAmount = nextRolloverAmount;
        if (!createdIds.has(currentPeriodBudget.id)) {
          changedBudgetIds.add(currentPeriodBudget.id);
        }
      }
    }

    periodCursor = nextYearMonth(periodCursor);
  }

  return { budgets: workingBudgets, changedBudgetIds, createdBudgets };
}
