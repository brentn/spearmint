import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { CategoriesService } from '../categories/categories.service';
import { DatabaseService } from '../data/database.service';
import type { Account, Budget, Category, Transaction, YearMonth } from '../data/models';
import { SimplefinSyncService } from '../simplefin/simplefin-sync.service';
import { TransactionMutationService, type TransactionEditFields } from '../transactions/transaction-mutation.service';
import {
  type BudgetPeriodView,
  type BudgetRowViewModel,
  type BudgetsAggregate,
  type FlowProgressViewModel,
  computeBudgetPeriodView,
  getDescendantCategories,
} from './budget-engine.util';
import { BudgetsService } from './budgets.service';
import { currentYearMonth, formatYearMonth, nextYearMonth, previousYearMonth } from './period.util';

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

  private readonly periodView = computed<BudgetPeriodView>(() =>
    computeBudgetPeriodView(this.budgets(), this.categories(), this.transactions(), this.period(), this.monthPhrase()),
  );

  readonly rows = computed<BudgetRowViewModel[]>(() => this.periodView().rows);

  readonly aggregate = computed<BudgetsAggregate>(() => this.periodView().aggregate);

  /** Income/expenses progress widget view model (issue #42) — the one place in the app where
   * an uncategorized transaction counts toward a budget total (see ADR-0018). */
  readonly flowProgress = computed<FlowProgressViewModel>(() => this.periodView().flowProgress);

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
}
