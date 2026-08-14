import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { CategoriesService } from '../categories/categories.service';
import { DatabaseService } from '../data/database.service';
import type { Budget, Category, CategoryType, Transaction } from '../data/models';
import { SimplefinSyncService } from '../simplefin/simplefin-sync.service';
import {
  type BudgetState,
  buildSignedActualsMap,
  computeBudgetStatus,
  getEffectiveBudgetForScope,
  getRollupActualAmount,
} from './budget-engine.util';
import { BudgetsService } from './budgets.service';
import { currentYearMonth, elapsedMonthFraction, formatYearMonth } from './period.util';

export interface BudgetRowViewModel {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryType: CategoryType;
  amount: number;
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
}

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

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly categories = signal<Category[]>([]);
  readonly rows = signal<BudgetRowViewModel[]>([]);

  readonly aggregate = computed<BudgetsAggregate>(() => this.buildAggregate(this.rows()));

  constructor() {
    effect(() => {
      if (!this.syncService.syncing()) {
        void this.refresh();
      }
    });
  }

  categoriesWithoutCurrentBudget(): Category[] {
    const budgetedCategoryIds = new Set(this.rows().map((row) => row.categoryId));
    return this.categories().filter((category) => !budgetedCategoryIds.has(category.id));
  }

  async refresh(): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const [budgets, transactionDocs, categories] = await Promise.all([
      this.budgetsService.reconcileAndList(),
      db.transactions.find().exec(),
      this.categoriesService.list(),
    ]);
    const transactions = transactionDocs.map((doc) => doc.toJSON());
    this.categories.set(categories);
    this.rows.set(this.buildRows(budgets, categories, transactions));
    this.loading.set(false);
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
    const actualsByPeriodAndCategory = buildSignedActualsMap(transactions, categories);

    const rows: BudgetRowViewModel[] = [];
    for (const category of categories) {
      const effectiveBudget = getEffectiveBudgetForScope(budgets, category.id, 'month', period);
      if (!effectiveBudget) {
        continue;
      }
      const spent = getRollupActualAmount(period, category.id, categories, actualsByPeriodAndCategory, budgets);
      const rolloverAmount = effectiveBudget.rolloverAmount ?? 0;
      const status = computeBudgetStatus(category.type, spent, effectiveBudget.amount, rolloverAmount);

      rows.push({
        id: effectiveBudget.id,
        categoryId: category.id,
        categoryName: category.name,
        categoryType: category.type,
        amount: effectiveBudget.amount,
        rollOver: effectiveBudget.rollOver,
        rolloverAmount,
        available: effectiveBudget.amount + rolloverAmount,
        spent,
        percent: status.percent,
        pctRounded: Math.round(status.percent * 100),
        barPercent: status.barPercent,
        pctLabelOnFill: status.barPercent > 0.22,
        state: status.state,
      });
    }

    rows.sort((a, b) => {
      if (a.categoryType === 'income' && b.categoryType !== 'income') {
        return 1;
      }
      if (a.categoryType !== 'income' && b.categoryType === 'income') {
        return -1;
      }
      return a.categoryName.localeCompare(b.categoryName);
    });

    return rows;
  }

  private buildAggregate(rows: BudgetRowViewModel[]): BudgetsAggregate {
    const expenseRows = rows.filter((row) => row.categoryType !== 'income');
    const incomeRows = rows.filter((row) => row.categoryType === 'income');

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
