import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../data/database.service';
import type { Budget, YearMonth } from '../data/models';
import { validateBudgetWrite } from './budget-validation.util';
import { recomputeRollovers } from './budget-engine.util';
import { currentYearMonth } from './period.util';

export interface BudgetPatch {
  amount: number;
  rollOver: boolean;
  /** Present only to set a sticky manual rollover override for this exact period (requires
   * `rollOver`) — see recomputeRollovers' doc for what "sticky" means. */
  rolloverAmount?: number;
}

/**
 * Budget CRUD scoped to {categoryId, periodType, period}. `setForPeriod` is the one write
 * path behind both "add a budget" and "edit a budget" — any period may be targeted directly,
 * current or historical, so setting a category's first-ever budget starting several months
 * back works the same way as editing this month's amount.
 */
@Injectable({ providedIn: 'root' })
export class BudgetsService {
  private readonly databaseService = inject(DatabaseService);

  async list(): Promise<Budget[]> {
    const db = await this.databaseService.getDatabase();
    const docs = await db.budgets.find().exec();
    return docs.map((doc) => doc.toJSON());
  }

  /**
   * Recomputes and persists rollover amounts for every rollOver-enabled monthly budget
   * (see recomputeRollovers's doc for why this walks from the earliest such budget rather
   * than a single step back), then returns the resulting full budget list. Safe/idempotent
   * to call on every screen load.
   */
  async reconcileAndList(): Promise<Budget[]> {
    const db = await this.databaseService.getDatabase();
    const [budgetDocs, transactionDocs, categoryDocs] = await Promise.all([
      db.budgets.find().exec(),
      db.transactions.find().exec(),
      db.categories.find().exec(),
    ]);

    const result = recomputeRollovers(
      budgetDocs.map((doc) => doc.toJSON()),
      transactionDocs.map((doc) => doc.toJSON()),
      categoryDocs.map((doc) => doc.toJSON()),
      currentYearMonth(),
    );

    await Promise.all([
      ...[...result.changedBudgetIds].map(async (id) => {
        const doc = await db.budgets.findOne(id).exec();
        const updated = result.budgets.find((b) => b.id === id);
        if (doc && updated) {
          await doc.incrementalPatch({ rolloverAmount: updated.rolloverAmount });
        }
      }),
      ...(result.createdBudgets.length > 0 ? [db.budgets.bulkInsert(result.createdBudgets)] : []),
    ]);

    return result.budgets;
  }

  /**
   * Creates the `month` budget for `categoryId` at exactly `period` if none exists there yet,
   * or edits that row in place if one already does — the one write path for both "add" and
   * "edit," for any period. A manual `rolloverAmount` marks the row `rolloverManual: true`.
   */
  async setForPeriod(categoryId: string, period: YearMonth, patch: BudgetPatch): Promise<Budget> {
    const db = await this.databaseService.getDatabase();
    const category = await db.categories.findOne(categoryId).exec();
    if (!category) {
      throw new Error('Category not found.');
    }
    const patchError = validateBudgetWrite(category, patch);
    if (patchError) {
      throw new Error(patchError);
    }

    // Turning rollOver off always clears any stored rollover state — a non-rolling budget
    // carrying a stale rolloverAmount would otherwise still nudge its bar/status.
    const rolloverPatch = !patch.rollOver
      ? { rolloverAmount: 0, rolloverManual: false }
      : patch.rolloverAmount !== undefined
        ? { rolloverAmount: patch.rolloverAmount, rolloverManual: true }
        : {};

    const existing = await db.budgets.findOne({ selector: { categoryId, periodType: 'month', period } }).exec();
    if (existing) {
      const updated = await existing.incrementalPatch({
        amount: patch.amount,
        rollOver: patch.rollOver,
        ...rolloverPatch,
      });
      return updated.toJSON();
    }

    const budget: Budget = {
      id: crypto.randomUUID(),
      categoryId,
      periodType: 'month',
      period,
      rollOver: patch.rollOver,
      rolloverAmount: patch.rolloverAmount ?? 0,
      rolloverManual: patch.rolloverAmount !== undefined,
      amount: patch.amount,
    };
    await db.budgets.insert(budget);
    return budget;
  }

  async delete(id: string): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const doc = await db.budgets.findOne(id).exec();
    await doc?.remove();
  }
}
