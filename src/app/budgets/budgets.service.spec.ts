import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { budgetSchema, categorySchema, transactionSchema } from '../data/schemas';
import { DatabaseService } from '../data/database.service';
import type { Budget, Category, Transaction } from '../data/models';
import { currentYearMonth, previousYearMonth } from './period.util';
import { BudgetsService } from './budgets.service';

function seedCategory(overrides: Partial<Category> = {}): Category {
  return { id: 'cat-1', name: 'Groceries', parentCategoryId: null, type: 'expense', ...overrides };
}

function seedTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    accountId: 'acc-1',
    date: '2026-08-14',
    description: 'Test',
    amount: -50,
    pending: false,
    categoryId: 'cat-1',
    excludeFromBudget: false,
    notes: null,
    ...overrides,
  };
}

describe('BudgetsService', () => {
  let fakeDb: RxDatabase;
  let service: BudgetsService;

  beforeEach(async () => {
    fakeDb = await createRxDatabase({
      name: `budgets-service-test-${Math.random().toString(36).slice(2)}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
    });
    await fakeDb.addCollections({
      budgets: { schema: budgetSchema },
      categories: { schema: categorySchema },
      transactions: { schema: transactionSchema },
    });

    TestBed.configureTestingModule({
      providers: [
        BudgetsService,
        { provide: DatabaseService, useValue: { getDatabase: () => Promise.resolve(fakeDb) } },
      ],
    });
    service = TestBed.inject(BudgetsService);
  });

  afterEach(async () => {
    await fakeDb.remove();
  });

  describe('setForPeriod', () => {
    it('creates a monthly budget for the given period', async () => {
      await fakeDb['categories'].insert(seedCategory());

      const budget = await service.setForPeriod('cat-1', currentYearMonth(), { amount: 500, rollOver: true });

      expect(budget.periodType).toBe('month');
      expect(budget.period).toBe(currentYearMonth());
      expect(budget.rolloverAmount).toBe(0);
      const all = await service.list();
      expect(all).toHaveLength(1);
    });

    it('creates a budget dated to a past period directly, for a category with no prior budget at all', async () => {
      await fakeDb['categories'].insert(seedCategory());
      const historicalPeriod = previousYearMonth(previousYearMonth(currentYearMonth()));

      const budget = await service.setForPeriod('cat-1', historicalPeriod, { amount: 300, rollOver: false });

      expect(budget.period).toBe(historicalPeriod);
      const all = await service.list();
      expect(all).toHaveLength(1);
      expect(all[0].period).toBe(historicalPeriod);
    });

    it('rejects a missing category', async () => {
      await expect(
        service.setForPeriod('missing', currentYearMonth(), { amount: 100, rollOver: false }),
      ).rejects.toThrow('Category not found.');
    });

    it('rejects a negative amount', async () => {
      await fakeDb['categories'].insert(seedCategory());
      await expect(
        service.setForPeriod('cat-1', currentYearMonth(), { amount: -5, rollOver: false }),
      ).rejects.toThrow('Budget amount must be greater than or equal to 0.');
    });

    it('rejects rollOver on an income category (no rollover toggle for Income budgets)', async () => {
      await fakeDb['categories'].insert(seedCategory({ id: 'paycheck', type: 'income' }));
      await expect(
        service.setForPeriod('paycheck', currentYearMonth(), { amount: 4000, rollOver: true }),
      ).rejects.toThrow('Income budgets cannot roll over.');
    });

    it('edits the existing row for that exact period in place, rather than creating a duplicate', async () => {
      await fakeDb['categories'].insert(seedCategory());
      const created = await service.setForPeriod('cat-1', currentYearMonth(), { amount: 500, rollOver: false });

      const updated = await service.setForPeriod('cat-1', currentYearMonth(), { amount: 600, rollOver: true });

      expect(updated.id).toBe(created.id);
      const all = await service.list();
      expect(all).toHaveLength(1);
      expect(all[0].amount).toBe(600);
      expect(all[0].rollOver).toBe(true);
    });

    it('edits a historical row in place, leaving other periods untouched', async () => {
      await fakeDb['categories'].insert(seedCategory());
      const historicalPeriod = previousYearMonth(previousYearMonth(currentYearMonth()));
      const historical: Budget = {
        id: 'historical-1',
        categoryId: 'cat-1',
        periodType: 'month',
        period: historicalPeriod,
        rollOver: false,
        rolloverAmount: 0,
        amount: 300,
      };
      await fakeDb['budgets'].insert(historical);

      await service.setForPeriod('cat-1', historicalPeriod, { amount: 450, rollOver: false });

      const all = await service.list();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('historical-1');
      expect(all[0].amount).toBe(450);
    });

    it('rejects a negative amount on an existing row', async () => {
      await fakeDb['categories'].insert(seedCategory());
      await service.setForPeriod('cat-1', currentYearMonth(), { amount: 500, rollOver: false });
      await expect(
        service.setForPeriod('cat-1', currentYearMonth(), { amount: -1, rollOver: false }),
      ).rejects.toThrow('Budget amount must be greater than or equal to 0.');
    });

    it('rejects turning on rollOver for an income budget', async () => {
      await fakeDb['categories'].insert(seedCategory({ id: 'paycheck', type: 'income' }));
      await service.setForPeriod('paycheck', currentYearMonth(), { amount: 4000, rollOver: false });
      await expect(
        service.setForPeriod('paycheck', currentYearMonth(), { amount: 4000, rollOver: true }),
      ).rejects.toThrow('Income budgets cannot roll over.');
    });

    it('rejects a rolloverAmount without rollOver enabled', async () => {
      await fakeDb['categories'].insert(seedCategory());
      await expect(
        service.setForPeriod('cat-1', currentYearMonth(), { amount: 500, rollOver: false, rolloverAmount: 20 }),
      ).rejects.toThrow('Turn on rollover before setting a rollover amount.');
    });

    it('setting a rolloverAmount marks the row rolloverManual, permanently sticky', async () => {
      await fakeDb['categories'].insert(seedCategory());
      await service.setForPeriod('cat-1', currentYearMonth(), { amount: 500, rollOver: true });

      const budget = await service.setForPeriod('cat-1', currentYearMonth(), {
        amount: 500,
        rollOver: true,
        rolloverAmount: -75,
      });

      expect(budget.rolloverAmount).toBe(-75);
      expect(budget.rolloverManual).toBe(true);
    });

    it('turning rollOver off clears any previously-manual rollover state', async () => {
      await fakeDb['categories'].insert(seedCategory());
      await service.setForPeriod('cat-1', currentYearMonth(), {
        amount: 500,
        rollOver: true,
        rolloverAmount: -75,
      });

      const budget = await service.setForPeriod('cat-1', currentYearMonth(), { amount: 500, rollOver: false });

      expect(budget.rolloverAmount).toBe(0);
      expect(budget.rolloverManual).toBe(false);
    });
  });

  describe('delete', () => {
    it('removes a budget', async () => {
      await fakeDb['categories'].insert(seedCategory());
      const budget = await service.setForPeriod('cat-1', currentYearMonth(), { amount: 500, rollOver: false });

      await service.delete(budget.id);

      expect(await service.list()).toHaveLength(0);
    });
  });

  describe('reconcileAndList', () => {
    it('persists a newly-computed rollover as a new budget row for the current period', async () => {
      await fakeDb['categories'].insert(seedCategory());
      const previousPeriod = previousYearMonth(currentYearMonth());
      const priorBudget: Budget = {
        id: 'prior',
        categoryId: 'cat-1',
        periodType: 'month',
        period: previousPeriod,
        rollOver: true,
        rolloverAmount: 0,
        amount: 500,
      };
      await fakeDb['budgets'].insert(priorBudget);
      await fakeDb['transactions'].insert(seedTransaction({ date: `${previousPeriod}-10`, amount: -300 }));

      const result = await service.reconcileAndList();

      const currentBudget = result.find((b) => b.period === currentYearMonth());
      expect(currentBudget?.rolloverAmount).toBe(200);

      // and it's actually persisted, not just returned in-memory
      const persisted = await service.list();
      expect(persisted.find((b) => b.period === currentYearMonth())?.rolloverAmount).toBe(200);
    });

    it('is a no-op when there are no rollOver-enabled monthly budgets', async () => {
      await fakeDb['categories'].insert(seedCategory());
      await service.setForPeriod('cat-1', currentYearMonth(), { amount: 500, rollOver: false });

      const result = await service.reconcileAndList();

      expect(result).toHaveLength(1);
    });
  });
});
