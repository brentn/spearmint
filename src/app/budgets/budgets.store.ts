import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { CategoriesService } from '../categories/categories.service';
import { DatabaseService } from '../data/database.service';
import type { Account, Budget, Category, CategoryType, Transaction, YearMonth } from '../data/models';
import { SimplefinSyncService } from '../simplefin/simplefin-sync.service';
import { TransactionMutationService, type TransactionEditFields } from '../transactions/transaction-mutation.service';
import {
  type BudgetState,
  type FlowProgressViewModel,
  buildFlowProgressRow,
  buildSignedActualsMap,
  computeBudgetStatus,
  computeUncategorizedTotals,
  getCombinedActualAmount,
  getCombinedBudgetAmounts,
  getDescendantCategories,
  getEffectiveBudgetForScope,
} from './budget-engine.util';
import { BudgetsService } from './budgets.service';
import {
  currentYearMonth,
  elapsedMonthFraction,
  formatYearMonth,
  isFinalWeekOfMonth,
  nextYearMonth,
  previousYearMonth,
} from './period.util';

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

/**
 * Screen-scoped store for the Budgets tab and Budget detail, following this codebase's
 * plain-signals-refreshed-imperatively convention (TransactionsStore/AccountsStore).
 * `period` (issue #23) lets the Budgets screen browse any month, past or current — creating and
 * editing a budget always targets whichever period is currently being viewed, so backdating a
 * category's first budget or correcting an old month's amount both just mean browsing there
 * first. Rollover is normally computed on read via BudgetsService.reconcileAndList(), except for
 * a period a user has manually overridden (`rolloverManual`), which is never recomputed.
 */
@Injectable()
export class BudgetsStore {
  private readonly budgetsService = inject(BudgetsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly databaseService = inject(DatabaseService);
  private readonly syncService = inject(SimplefinSyncService);
  private readonly mutationService = inject(TransactionMutationService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly budgets = signal<Budget[]>([]);
  readonly transactions = signal<Transaction[]>([]);
  readonly accounts = signal<Account[]>([]);
  /** The month currently being viewed (issue #23) — defaults to the current month, moved by
   * goToPreviousMonth()/goToNextMonth(). Purely a view-side concern: reconcileAndList() always
   * reconciles rollovers through the real current month regardless of what's being viewed. */
  readonly period = signal<YearMonth>(currentYearMonth());
  readonly isCurrentPeriod = computed(() => this.period() === currentYearMonth());
  /** "this month" only reads correctly for the real current month — a viewed period names
   * itself instead ("...in July 2026"). Shared by the aggregate message, the list screen's
   * progress-card label, and Budget Detail's hero label, so the phrasing stays one place. */
  readonly monthPhrase = computed(() =>
    this.isCurrentPeriod() ? 'this month' : `in ${formatYearMonth(this.period())}`,
  );
  /** Query params for links into/around Budget Detail (issue #23 follow-up) — carries `{ period }`
   * forward so drilling into a category, or backing out of one, stays anchored to the month being
   * browsed. Undefined for the current month, matching today's plain links. */
  readonly linkQueryParams = computed<{ period: YearMonth } | undefined>(() =>
    this.isCurrentPeriod() ? undefined : { period: this.period() },
  );

  /** Earliest month with any transaction at all, or null with none — the floor for
   * goToPreviousMonth() (issue #23: "no need to view ... months prior to the earliest transaction"). */
  private readonly earliestTransactionPeriod = computed<YearMonth | null>(() => {
    const dates = this.transactions().map((t) => t.date.slice(0, 7));
    return dates.length === 0 ? null : dates.reduce((min, d) => (d < min ? d : min));
  });
  readonly canGoToPreviousMonth = computed(() => {
    const earliest = this.earliestTransactionPeriod();
    return earliest !== null && this.period() > earliest;
  });
  readonly canGoToNextMonth = computed(() => this.period() < currentYearMonth());

  readonly rows = computed<BudgetRowViewModel[]>(() =>
    this.buildRows(this.budgets(), this.categories(), this.transactions(), this.period()),
  );

  readonly aggregate = computed<BudgetsAggregate>(() =>
    this.buildAggregate(this.rows(), this.transactions(), this.categories(), this.period(), this.monthPhrase()),
  );

  /** Income/expenses progress widget view model (issue #42) — the one place in the app where
   * an uncategorized transaction counts toward a budget total (see ADR-0018). */
  readonly flowProgress = computed<FlowProgressViewModel>(() => {
    const uncategorized = computeUncategorizedTotals(this.transactions(), this.period());
    const aggregate = this.aggregate();
    return {
      income: buildFlowProgressRow('income', aggregate.earned, uncategorized.income, aggregate.budgetedIncome),
      expenses: buildFlowProgressRow('expense', aggregate.spent, uncategorized.expenses, aggregate.totalBudget),
    };
  });

  /** Rows for the Budgets screen's dedicated "Income" section list — hides the sole implied
   * top-level Income rollup row when there's exactly one top-level income category, since with
   * only one such category the rollup just repeats its own children with no comparison value
   * (issue #42). Kept whenever 2+ top-level income categories exist, where the rollup lets
   * each source's own total be compared against the others. */
  readonly incomeSectionRows = computed<BudgetRowViewModel[]>(() => {
    const rows = this.rows().filter((row) => row.categoryType === 'income');
    const topLevelIncomeCategoryCount = this.categories().filter(
      (category) => category.type === 'income' && category.parentCategoryId === null,
    ).length;
    if (topLevelIncomeCategoryCount !== 1) {
      return rows;
    }
    return rows.filter((row) => !(row.parentCategoryId === null && row.implied));
  });

  constructor() {
    effect(() => {
      if (!this.syncService.syncing()) {
        void this.refresh();
      }
    });
  }

  goToPreviousMonth(): void {
    if (this.canGoToPreviousMonth()) {
      this.period.set(previousYearMonth(this.period()));
    }
  }

  goToNextMonth(): void {
    if (this.canGoToNextMonth()) {
      this.period.set(nextYearMonth(this.period()));
    }
  }

  /** A category whose only row is implied (computed from budgeted descendants) still counts as
   * "not yet budgeted" here — it must stay selectable in the Add-budget picker (issue #15).
   * Scoped to the currently-viewed period, not necessarily the real current month. */
  categoriesWithoutBudgetThisPeriod(): Category[] {
    const budgetedCategoryIds = new Set(
      this.rows()
        .filter((row) => !row.implied)
        .map((row) => row.categoryId),
    );
    return this.categories().filter((category) => !budgetedCategoryIds.has(category.id));
  }

  /** Transactions for `categoryId` and all of its descendants (any depth), the viewed period
   * only — the combined transaction list backing a (real or implied) parent's Budget Detail screen. */
  transactionsForCategoryTree(categoryId: string): Transaction[] {
    const period = this.period();
    const treeIds = new Set([categoryId, ...getDescendantCategories(categoryId, this.categories()).map((c) => c.id)]);
    return this.transactions()
      .filter((t) => t.categoryId !== null && treeIds.has(t.categoryId) && t.date.slice(0, 7) === period)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async refresh(): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const [budgets, transactionDocs, categories, accountDocs] = await Promise.all([
      this.budgetsService.reconcileAndList(),
      db.transactions.find().exec(),
      this.categoriesService.list(),
      db.accounts.find().exec(),
    ]);
    const transactions = transactionDocs.map((doc) => doc.toJSON());
    this.categories.set(categories);
    this.transactions.set(transactions);
    this.accounts.set(accountDocs.map((doc) => doc.toJSON()));
    this.budgets.set(budgets);
    this.loading.set(false);
  }

  accountName(accountId: string): string {
    return this.accounts().find((a) => a.id === accountId)?.name ?? '';
  }

  /** The transaction-edit dialog's Save button — one write, one refresh for all three
   * editable fields, mirroring TransactionsStore's own saveEdit (issue #19). */
  async saveEdit(transactionId: string, changes: TransactionEditFields): Promise<void> {
    await this.mutationService.saveEdit(transactionId, changes);
    await this.refresh();
  }

  /** Sets category's budget for whichever period is currently being viewed (`this.period()`) —
   * creates it if it doesn't exist yet there, edits in place if it does. `rolloverAmount`
   * manually (and permanently) overrides the computed rollover for that period; omit it to
   * leave rollover computed as usual. Refreshing afterward re-runs reconcileAndList(), so any
   * later period's rollover reflects the change immediately, not just on next load. */
  async setBudget(categoryId: string, amount: number, rollOver: boolean, rolloverAmount?: number): Promise<void> {
    this.error.set(null);
    try {
      await this.budgetsService.setForPeriod(categoryId, this.period(), { amount, rollOver, rolloverAmount });
      await this.refresh();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not save that budget.');
    }
  }

  async deleteBudget(id: string): Promise<void> {
    await this.budgetsService.delete(id);
    await this.refresh();
  }

  private buildRows(
    budgets: Budget[],
    categories: Category[],
    transactions: Transaction[],
    period: YearMonth,
  ): BudgetRowViewModel[] {
    const isIncomeInfoPeriod = !isFinalWeekOfMonth(period);
    const actualsByPeriodAndCategory = buildSignedActualsMap(transactions, categories);

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

    return this.orderByCategoryTree(rows);
  }

  /** Parent-above-children ordering within each type group (issue #21): top-level rows sorted
   * alphabetically, each immediately followed by its own children (also alphabetical) — the
   * income group still sorts after expense/transfer, matching the pre-#21 group split. */
  private orderByCategoryTree(rows: BudgetRowViewModel[]): BudgetRowViewModel[] {
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

  private buildAggregate(
    rows: BudgetRowViewModel[],
    transactions: Transaction[],
    categories: Category[],
    period: YearMonth,
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
    const actualsByPeriodAndCategory = buildSignedActualsMap(transactions, categories);
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
          ? `Keep it up! You can save $${Math.round(remaining)} more ${monthPhrase}`
          : `You're $${Math.round(Math.abs(remaining))} over budget ${monthPhrase}`,
      todayPercent: elapsedMonthFraction(period) * 100,
      earned,
      spent: totalSpent,
      cashFlowNet: earned - totalSpent,
      budgetedIncome,
    };
  }
}
