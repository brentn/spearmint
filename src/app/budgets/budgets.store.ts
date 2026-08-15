import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { CategoriesService } from '../categories/categories.service';
import { DatabaseService } from '../data/database.service';
import type { Account, Budget, Category, CategoryType, Transaction } from '../data/models';
import { SimplefinSyncService } from '../simplefin/simplefin-sync.service';
import { TransactionMutationService } from '../transactions/transaction-mutation.service';
import {
  type BudgetState,
  buildSignedActualsMap,
  computeBudgetStatus,
  getCombinedActualAmount,
  getCombinedBudgetAmounts,
  getDescendantCategories,
  getEffectiveBudgetForScope,
} from './budget-engine.util';
import { BudgetsService } from './budgets.service';
import { currentYearMonth, elapsedMonthFraction, formatYearMonth, isFinalWeekOfMonth } from './period.util';

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
  available: number;
  spent: number;
  percent: number;
  pctRounded: number;
  barPercent: number;
  /** Whether the percentage label sits on top of the filled portion of the bar (vs. beside it). */
  pctLabelOnFill: boolean;
  state: BudgetState;
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
}

/**
 * Screen-scoped store for the Budgets tab and Budget detail, following this codebase's
 * plain-signals-refreshed-imperatively convention (TransactionsStore/AccountsStore). Only
 * ever shows/edits the current period — there's no period navigation in the locked visual
 * spec, and no period-closing UI (spec §4): rollover is purely computed on read via
 * BudgetsService.reconcileAndList(), never entered or confirmed by the user.
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
  readonly rows = signal<BudgetRowViewModel[]>([]);
  readonly transactions = signal<Transaction[]>([]);
  readonly accounts = signal<Account[]>([]);

  readonly aggregate = computed<BudgetsAggregate>(() => this.buildAggregate(this.rows()));

  constructor() {
    effect(() => {
      if (!this.syncService.syncing()) {
        void this.refresh();
      }
    });
  }

  /** A category whose only row is implied (computed from budgeted descendants) still counts as
   * "not yet budgeted" here — it must stay selectable in the Add-budget picker (issue #15). */
  categoriesWithoutCurrentBudget(): Category[] {
    const budgetedCategoryIds = new Set(
      this.rows()
        .filter((row) => !row.implied)
        .map((row) => row.categoryId),
    );
    return this.categories().filter((category) => !budgetedCategoryIds.has(category.id));
  }

  /** Transactions for `categoryId` and all of its descendants (any depth), current period only —
   * the combined transaction list backing a (real or implied) parent's Budget Detail screen. */
  transactionsForCategoryTree(categoryId: string): Transaction[] {
    const period = currentYearMonth();
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
    this.rows.set(this.buildRows(budgets, categories, transactions));
    this.loading.set(false);
  }

  accountName(accountId: string): string {
    return this.accounts().find((a) => a.id === accountId)?.name ?? '';
  }

  /** Delegates to TransactionMutationService (issue #19), mirroring TransactionsStore's own
   * delegate methods so a category correction is recorded consistently regardless of screen. */
  async assignCategory(transactionId: string, categoryId: string | null): Promise<void> {
    await this.mutationService.assignCategory(transactionId, categoryId);
    await this.refresh();
  }

  async setNotes(transactionId: string, notes: string | null): Promise<void> {
    await this.mutationService.setNotes(transactionId, notes);
    await this.refresh();
  }

  async setExcludeFromBudget(transactionId: string, excludeFromBudget: boolean): Promise<void> {
    await this.mutationService.setExcludeFromBudget(transactionId, excludeFromBudget);
    await this.refresh();
  }

  async addBudget(categoryId: string, amount: number, rollOver: boolean): Promise<void> {
    this.error.set(null);
    try {
      await this.budgetsService.create({ categoryId, amount, rollOver });
      await this.refresh();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not add that budget.');
    }
  }

  async updateBudget(id: string, amount: number, rollOver: boolean): Promise<void> {
    this.error.set(null);
    try {
      await this.budgetsService.update(id, { amount, rollOver });
      await this.refresh();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not update that budget.');
    }
  }

  async deleteBudget(id: string): Promise<void> {
    await this.budgetsService.delete(id);
    await this.refresh();
  }

  private buildRows(budgets: Budget[], categories: Category[], transactions: Transaction[]): BudgetRowViewModel[] {
    const period = currentYearMonth();
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
      const ownBudget = getEffectiveBudgetForScope(budgets, category.id, 'month', period);
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
        available: combined.amount + combined.rolloverAmount,
        spent,
        percent: status.percent,
        pctRounded: Math.round(status.percent * 100),
        barPercent: status.barPercent,
        pctLabelOnFill: status.barPercent > 0.22,
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

  private buildAggregate(rows: BudgetRowViewModel[]): BudgetsAggregate {
    // Top-level rows only (real or implied): a parent row already fully absorbs its descendants'
    // amount/rollover/spend (issue #15's unified rollup), so counting a child's own row here too
    // would double-count it. Independent of the "Show subcategories" toggle, which is purely
    // presentational over this same row set.
    const topLevelRows = rows.filter((row) => row.parentCategoryId === null);
    const expenseRows = topLevelRows.filter((row) => row.categoryType !== 'income');
    const incomeRows = topLevelRows.filter((row) => row.categoryType === 'income');

    const totalSpent = expenseRows.reduce((sum, row) => sum + row.spent, 0);
    const totalBudget = expenseRows.reduce((sum, row) => sum + row.available, 0);
    const remaining = totalBudget - totalSpent;
    const overallStatus = computeBudgetStatus('expense', totalSpent, totalBudget, 0);
    const earned = incomeRows.reduce((sum, row) => sum + row.spent, 0);
    const period = currentYearMonth();

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
          ? `Keep it up! You can save $${Math.round(remaining)} more this month`
          : `You're $${Math.round(Math.abs(remaining))} over budget this month`,
      todayPercent: elapsedMonthFraction(period) * 100,
      earned,
      spent: totalSpent,
      cashFlowNet: earned - totalSpent,
    };
  }
}
