import type { Budget, Category, CategoryType, Transaction, YearMonth } from '../data/models';
import { elapsedMonthFraction, formatYearMonth, isFinalWeekOfMonth, nextYearMonth, previousYearMonth } from './period.util';

/**
 * The budget engine. `Transaction.amount` follows SimpleFIN's "positive = deposit"
 * convention, so expense/transfer spend arrives as negative numbers and must be negated
 * to get a positive "amount spent" for budget math.
 *
 * Two entry points: `computeBudgetPeriodView` builds everything the Budgets screen renders
 * for one period (rows, the month aggregate, and the income/expenses flow-progress widget)
 * in a single pass over a signed-actuals map computed once. `recomputeRollovers` is separate —
 * persisted `Rollover` state, recomputed on load rather than derived per-render.
 */

const EXPENSE_WARNING_THRESHOLD = 1.01;
const EXPENSE_OVER_THRESHOLD = 1.1;
const INCOME_WARNING_THRESHOLD = 0.7;
/** A reversed (negative-total) bar is capped short of full width — a -100% reversed bar would
 * otherwise be pixel-identical to a +100% forward one, since a fully-filled track shows no bare
 * pixel to reveal which edge it grew from. The gap this leaves is also where the overflow
 * chevron/label render once the true magnitude exceeds it. */
const REVERSED_CAP = 0.9;

/** 'info' is a presentation-only override — applied to a per-category income row before the
 * final week of the month (issue #21), and unconditionally to the flow-progress widget's income
 * row — never produced by computeBudgetStatus itself. */
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
function buildSignedActualsMap(transactions: Transaction[], categories: Category[]): Map<string, number> {
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

export function getBudgetForExactPeriod(budgets: Budget[], categoryId: string, period: YearMonth): Budget | null {
  return budgets.find((b) => b.categoryId === categoryId && b.periodType === 'month' && b.period === period) ?? null;
}

/** Most recent monthly budget at or before `period` for this category. */
function getEffectiveBudgetForScope(budgets: Budget[], categoryId: string, period: YearMonth): Budget | null {
  const candidate = budgets
    .filter((b) => b.categoryId === categoryId && b.periodType === 'month' && b.period <= period)
    .sort((a, b) => b.period.localeCompare(a.period))[0];
  return candidate ?? null;
}

/**
 * A category's own envelope actual (spec §4) — distinct from the full-tree "combined actual"
 * below (see `getCombinedActualAmount`'s doc for the contrast). Used only by the rollover
 * engine: a budgeted descendant manages its own `Rollover` chain independently, so its spend
 * must NOT flow up into an ancestor's envelope too, or it would be carried forward twice —
 * once in the descendant's own rollover, once in the ancestor's. So this sums direct spend plus
 * every *unbudgeted* descendant's spend, stopping the recursion the moment a descendant has its
 * own effective-as-of-that-period budget (not "has a budget ever").
 */
export function getEnvelopeActualAmount(
  period: YearMonth,
  categoryId: string,
  categories: Category[],
  actualsByPeriodAndCategory: Map<string, number>,
  budgets: Budget[],
): number {
  const direct = actualsByPeriodAndCategory.get(`${period}:${categoryId}`) ?? 0;
  const children = categories.filter((c) => c.parentCategoryId === categoryId);

  const childContribution = children.reduce((sum, child) => {
    const childIsBudgetedThisPeriod = getEffectiveBudgetForScope(budgets, child.id, period) !== null;

    return (
      sum +
      (childIsBudgetedThisPeriod
        ? 0 // child manages its own envelope — already carried in its own rollover chain
        : getEnvelopeActualAmount(period, child.id, categories, actualsByPeriodAndCategory, budgets))
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
 * Full-subtree "combined actual" (issue #15's unified rollup rule) — the basis for a combined
 * row's displayed `spent`. Unlike `getEnvelopeActualAmount` (the rollover engine's own-envelope
 * math, which stops at a budgeted descendant so that descendant's spend isn't carried forward
 * twice), this always includes every descendant's spend regardless of whether that descendant
 * has its own budget: a display total should read as "everything under this category," not
 * "just what this category's own envelope is on the hook for."
 */
function getCombinedActualAmount(
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

interface CombinedBudgetAmounts {
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
function getCombinedBudgetAmounts(
  categoryId: string,
  categories: Category[],
  budgets: Budget[],
  period: YearMonth,
): CombinedBudgetAmounts {
  const ownBudget = getEffectiveBudgetForScope(budgets, categoryId, period);
  const descendants = getDescendantCategories(categoryId, categories);

  let amount = ownBudget?.amount ?? 0;
  let rolloverAmount = ownBudget?.rolloverAmount ?? 0;
  let hasBudgetedDescendant = false;

  for (const descendant of descendants) {
    const descendantBudget = getEffectiveBudgetForScope(budgets, descendant.id, period);
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
function computeBudgetStatus(
  categoryType: CategoryType,
  spent: number,
  amount: number,
  rolloverAmount: number,
): BudgetStatus {
  const progress = spent - rolloverAmount;
  const percent = amount > 0 ? progress / amount : progress > 0 ? 1 : progress < 0 ? -1 : 0;
  const reversed = percent < 0;
  const reversedCapped = reversed && Math.abs(percent) > REVERSED_CAP;
  const barPercent = reversed ? Math.min(REVERSED_CAP, Math.abs(percent)) : Math.max(0, Math.min(1, percent));

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

interface UncategorizedTotals {
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
function computeUncategorizedTotals(transactions: Transaction[], period: YearMonth): UncategorizedTotals {
  let income = 0;
  let expenses = 0;

  for (const transaction of transactions) {
    if (transaction.categoryId !== null || transaction.excludeFromBudget || transaction.date.slice(0, 7) !== period) {
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
function buildFlowProgressRow(
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
      const previousEffectiveBudget = getEffectiveBudgetForScope(workingBudgets, categoryId, previousPeriod);
      const existingCurrent = getBudgetForExactPeriod(workingBudgets, categoryId, periodCursor);

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
      const previousActual = getEnvelopeActualAmount(
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

// ---------------------------------------------------------------------------
// Period view: rows + aggregate + flow-progress for one period, in one pass.
// ---------------------------------------------------------------------------

export interface BudgetRowViewModel {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryType: CategoryType;
  parentCategoryId: string | null;
  /** Combined amount: own explicit budget's amount (0 if none) plus every budgeted descendant's
   * own amount (issue #15's unified amount rule) — what the progress bar and hero display. */
  amount: number;
  /** This category's own explicit budget amount (0 if none/implied) — distinct from `amount`
   * whenever it has a budgeted descendant. Editing a real budget must prefill/persist this, not
   * the combined `amount`, or saving with no changes would silently inflate it every time. */
  ownAmount: number;
  rollOver: boolean;
  rolloverAmount: number;
  /** True when this period's rolloverAmount was manually set (see Budget.rolloverManual) — the
   * engine never recomputes it. Always false for an implied row. */
  rolloverManual: boolean;
  available: number;
  spent: number;
  percent: number;
  pctRounded: number;
  barPercent: number;
  /** Whether the percentage label sits on top of the filled portion of the bar (vs. beside it).
   * Direction-agnostic by construction, not by coincidence: the templates anchor the on-fill
   * label at the track's right edge regardless of `reversed`, and a reversed fill is itself
   * anchored flush to that same right edge, so once the fill is large enough to trigger this the
   * label always lands on colored area either direction. Ignored entirely when `reversedCapped`
   * is true — the label moves into the chevron/overflow group instead. */
  pctLabelOnFill: boolean;
  state: BudgetState;
  /** True when the category's actual went negative (e.g. a refund/reversal) — the bar fills from
   * the opposite edge. Direction only; `state`'s color already lands correctly either way. */
  reversed: boolean;
  /** True when a reversed bar's true magnitude exceeds the rendering cap — see `BudgetStatus.reversedCapped`. */
  reversedCapped: boolean;
  /** True for a synthetic row: no explicit budget of its own, computed from budgeted descendants
   * (issue #15). `id` is a stable synthetic identifier in this case, not a real Budget id. */
  implied: boolean;
}

/** Stable synthetic id for an implied row — distinct from real budget ids (randomUUID). */
const impliedRowId = (categoryId: string): string => `implied:${categoryId}`;

export interface BudgetsAggregate {
  monthName: string;
  totalSpent: number;
  totalBudget: number;
  remaining: number;
  overallPercent: number;
  overallBarPercent: number;
  overallState: BudgetState;
  message: string;
  todayPercent: number;
  earned: number;
  spent: number;
  cashFlowNet: number;
  /** Sum of top-level income rows' `available` (real or implied) — the income progress
   * widget's/cash-flow box's budget target, mirroring totalBudget's expense-side scope. */
  budgetedIncome: number;
}

export interface BudgetPeriodView {
  rows: BudgetRowViewModel[];
  aggregate: BudgetsAggregate;
  flowProgress: FlowProgressViewModel;
}

function buildRows(
  budgets: Budget[],
  categories: Category[],
  period: YearMonth,
  actualsByPeriodAndCategory: Map<string, number>,
): BudgetRowViewModel[] {
  const isIncomeInfoPeriod = !isFinalWeekOfMonth(period);

  const rows: BudgetRowViewModel[] = [];
  for (const category of categories) {
    const combined = getCombinedBudgetAmounts(category.id, categories, budgets, period);
    // `spent` already rolls up the whole subtree (getCombinedActualAmount), so a parent whose
    // only expense activity comes from an unbudgeted child qualifies here too — no separate
    // check needed to cover the "child or parent" half of issue #21's $0-computed-budget rule.
    const spent = getCombinedActualAmount(period, category.id, categories, actualsByPeriodAndCategory);
    const hasUnbudgetedExpenseActivity = category.type !== 'income' && spent !== 0;
    // Neither an explicit budget of its own, a budgeted descendant to imply one from, nor any
    // expense activity to imply a $0 budget from (issue #21) — no budget activity at all, so
    // this category stays out of the list entirely.
    if (!combined.hasOwnBudget && !combined.hasBudgetedDescendant && !hasUnbudgetedExpenseActivity) {
      continue;
    }
    const ownBudget = getEffectiveBudgetForScope(budgets, category.id, period);
    const status = computeBudgetStatus(category.type, spent, combined.amount, combined.rolloverAmount);

    rows.push({
      id: ownBudget?.id ?? impliedRowId(category.id),
      categoryId: category.id,
      categoryName: category.name,
      categoryType: category.type,
      parentCategoryId: category.parentCategoryId,
      amount: combined.amount,
      ownAmount: ownBudget?.amount ?? 0,
      rollOver: ownBudget?.rollOver ?? false,
      rolloverAmount: combined.rolloverAmount,
      rolloverManual: ownBudget?.rolloverManual ?? false,
      available: combined.amount + combined.rolloverAmount,
      spent,
      percent: status.percent,
      pctRounded: Math.round(status.percent * 100),
      barPercent: status.barPercent,
      pctLabelOnFill: status.barPercent > 0.22,
      reversed: status.reversed,
      reversedCapped: status.reversedCapped,
      // Neutral "too early to judge" color for an income target (issue #21) — the real
      // green/amber/red state resumes once the final week gives "behind target" real meaning.
      state: category.type === 'income' && isIncomeInfoPeriod ? 'info' : status.state,
      implied: ownBudget === null,
    });
  }

  return orderByCategoryTree(rows);
}

/** Parent-above-children ordering within each type group (issue #21): top-level rows sorted
 * alphabetically, each immediately followed by its own children (also alphabetical) — the
 * income group still sorts after expense/transfer, matching the pre-#21 group split. */
function orderByCategoryTree(rows: BudgetRowViewModel[]): BudgetRowViewModel[] {
  const byParent = new Map<string | null, BudgetRowViewModel[]>();
  for (const row of rows) {
    const siblings = byParent.get(row.parentCategoryId) ?? [];
    siblings.push(row);
    byParent.set(row.parentCategoryId, siblings);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }

  const ordered: BudgetRowViewModel[] = [];
  const appendTree = (row: BudgetRowViewModel): void => {
    ordered.push(row);
    for (const child of byParent.get(row.categoryId) ?? []) {
      appendTree(child);
    }
  };

  const topLevel = byParent.get(null) ?? [];
  for (const row of topLevel.filter((r) => r.categoryType !== 'income')) {
    appendTree(row);
  }
  for (const row of topLevel.filter((r) => r.categoryType === 'income')) {
    appendTree(row);
  }

  return ordered;
}

function buildAggregate(
  rows: BudgetRowViewModel[],
  categories: Category[],
  period: YearMonth,
  actualsByPeriodAndCategory: Map<string, number>,
  monthPhrase: string,
): BudgetsAggregate {
  // Top-level rows only (real or implied): a parent row already fully absorbs its descendants'
  // amount/rollover/spend (issue #15's unified rollup), so counting a child's own row here too
  // would double-count it. Independent of the "Show subcategories" toggle, which is purely
  // presentational over this same row set.
  const topLevelRows = rows.filter((row) => row.parentCategoryId === null);
  const expenseRows = topLevelRows.filter((row) => row.categoryType !== 'income');
  const topLevelIncomeRows = topLevelRows.filter((row) => row.categoryType === 'income');

  const totalSpent = expenseRows.reduce((sum, row) => sum + row.spent, 0);
  const totalBudget = expenseRows.reduce((sum, row) => sum + row.available, 0);
  const budgetedIncome = topLevelIncomeRows.reduce((sum, row) => sum + row.available, 0);
  const remaining = totalBudget - totalSpent;
  const overallStatus = computeBudgetStatus('expense', totalSpent, totalBudget, 0);
  // Deliberately not derived from `rows`/incomeRows (issue #21): a wholly unbudgeted income
  // category never gets a row (bullet 3's $0-computed-budget rule is scoped to expenses only —
  // see buildRows), but its earnings must still count toward the cash-flow box's "Earned" total
  // and its "unbudgeted actual" overage, so this sums every income category's actuals directly.
  const earned = categories
    .filter((category) => category.type === 'income')
    .reduce((sum, category) => sum + (actualsByPeriodAndCategory.get(`${period}:${category.id}`) ?? 0), 0);

  return {
    monthName: formatYearMonth(period),
    totalSpent,
    totalBudget,
    remaining,
    overallPercent: overallStatus.percent,
    overallBarPercent: overallStatus.barPercent,
    overallState: overallStatus.state,
    message:
      remaining >= 0
        ? `$${Math.round(remaining)} remaining ${monthPhrase}`
        : `You're $${Math.round(Math.abs(remaining))} over budget ${monthPhrase}`,
    todayPercent: elapsedMonthFraction(period) * 100,
    earned,
    spent: totalSpent,
    cashFlowNet: earned - totalSpent,
    budgetedIncome,
  };
}

/**
 * The one entry point for "what should the Budgets screen show for this period" — rows
 * (ordered, parent-above-children), the month aggregate, and the income/expenses flow-progress
 * widget, built from a single signed-actuals pass over `transactions`/`categories`.
 *
 * `monthPhrase` is caller-supplied ("this month" vs. "in July 2026") rather than derived here,
 * since whether `period` is the real current month depends on live wall-clock context the engine
 * has no other reason to know about, and the same phrase is reused by callers outside this view
 * (a screen's hero label, Budget Detail's category label).
 */
export function computeBudgetPeriodView(
  budgets: Budget[],
  categories: Category[],
  transactions: Transaction[],
  period: YearMonth,
  monthPhrase: string,
): BudgetPeriodView {
  const actualsByPeriodAndCategory = buildSignedActualsMap(transactions, categories);
  const rows = buildRows(budgets, categories, period, actualsByPeriodAndCategory);
  const aggregate = buildAggregate(rows, categories, period, actualsByPeriodAndCategory, monthPhrase);
  const uncategorized = computeUncategorizedTotals(transactions, period);

  return {
    rows,
    aggregate,
    flowProgress: {
      income: buildFlowProgressRow('income', aggregate.earned, uncategorized.income, aggregate.budgetedIncome),
      expenses: buildFlowProgressRow('expense', aggregate.spent, uncategorized.expenses, aggregate.totalBudget),
    },
  };
}
