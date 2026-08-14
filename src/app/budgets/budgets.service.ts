import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../data/database.service';
import type { Budget } from '../data/models';
import { validateBudgetWrite } from './budget-validation.util';
import { recomputeRollovers } from './budget-engine.util';
import { currentYearMonth } from './period.util';

export interface BudgetDraft {
  categoryId: string;
  amount: number;
  rollOver: boolean;
}

export interface BudgetPatch {
  amount: number;
  rollOver: boolean;
}

/**
 * Budget CRUD scoped to {categoryId, periodType, period} (spec §4). The CRUD surface only
 * ever creates/edits `periodType: 'month'` budgets for the current period — the UI never
 * offers a period picker, matching "no period-closing UI" (rollover is purely computed,
 * never manually entered).
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

  async create(draft: BudgetDraft): Promise<Budget> {
    const db = await this.databaseService.getDatabase();
    const category = await db.categories.findOne(draft.categoryId).exec();
    if (!category) {
      throw new Error('Category not found.');
    }
    const draftError = validateBudgetWrite(category, draft);
    if (draftError) {
      throw new Error(draftError);
    }

    const period = currentYearMonth();
    const existing = await db.budgets
      .findOne({ selector: { categoryId: draft.categoryId, periodType: 'month', period } })
      .exec();
    if (existing) {
      throw new Error('A budget already exists for this category this month.');
    }

    const budget: Budget = {
      id: crypto.randomUUID(),
      categoryId: draft.categoryId,
      periodType: 'month',
      period,
      rollOver: draft.rollOver,
      rolloverAmount: 0,
      amount: draft.amount,
    };
    await db.budgets.insert(budget);
    return budget;
  }

  /** Edits the current period's row in place; edits to a historical row create a fresh
   * current-period version instead, leaving history untouched (mirrors Peppermint). */
  async update(id: string, patch: BudgetPatch): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const doc = await db.budgets.findOne(id).exec();
    if (!doc) {
      throw new Error('Budget not found.');
    }
    const category = await db.categories.findOne(doc.categoryId).exec();
    if (!category) {
      throw new Error('Category not found.');
    }
    const patchError = validateBudgetWrite(category, patch);
    if (patchError) {
      throw new Error(patchError);
    }

    const period = currentYearMonth();
    if (doc.period === period) {
      await doc.incrementalPatch({ amount: patch.amount, rollOver: patch.rollOver });
      return;
    }

    const existingCurrent = await db.budgets
      .findOne({ selector: { categoryId: doc.categoryId, periodType: doc.periodType, period } })
      .exec();
    if (existingCurrent) {
      await existingCurrent.incrementalPatch({ amount: patch.amount, rollOver: patch.rollOver });
      return;
    }

    const newBudget: Budget = {
      id: crypto.randomUUID(),
      categoryId: doc.categoryId,
      periodType: doc.periodType,
      period,
      rollOver: patch.rollOver,
      rolloverAmount: 0,
      amount: patch.amount,
    };
    await db.budgets.insert(newBudget);
  }

  async delete(id: string): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const doc = await db.budgets.findOne(id).exec();
    await doc?.remove();
  }
}
