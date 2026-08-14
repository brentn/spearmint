import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
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
      storage: getRxStorageMemory(),
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

  describe('create', () => {
    it('creates a monthly budget for the current period', async () => {
      await fakeDb['categories'].insert(seedCategory());

      const budget = await service.create({ categoryId: 'cat-1', amount: 500, rollOver: true });

      expect(budget.periodType).toBe('month');
      expect(budget.period).toBe(currentYearMonth());
      expect(budget.rolloverAmount).toBe(0);
      const all = await service.list();
      expect(all).toHaveLength(1);
    });

    it('rejects a missing category', async () => {
      await expect(service.create({ categoryId: 'missing', amount: 100, rollOver: false })).rejects.toThrow(
        'Category not found.',
      );
    });

    it('rejects a negative amount', async () => {
      await fakeDb['categories'].insert(seedCategory());
      await expect(service.create({ categoryId: 'cat-1', amount: -5, rollOver: false })).rejects.toThrow(
        'Budget amount must be greater than or equal to 0.',
      );
    });

    it('rejects rollOver on an income category (no rollover toggle for Income budgets)', async () => {
      await fakeDb['categories'].insert(seedCategory({ id: 'paycheck', type: 'income' }));
      await expect(service.create({ categoryId: 'paycheck', amount: 4000, rollOver: true })).rejects.toThrow(
        'Income budgets cannot roll over.',
      );
    });

    it('rejects a duplicate budget for the same category this period', async () => {
      await fakeDb['categories'].insert(seedCategory());
      await service.create({ categoryId: 'cat-1', amount: 500, rollOver: false });

      await expect(service.create({ categoryId: 'cat-1', amount: 100, rollOver: false })).rejects.toThrow(
        'A budget already exists for this category this month.',
      );
    });
  });

  describe('update', () => {
    it('patches a current-period budget in place', async () => {
      await fakeDb['categories'].insert(seedCategory());
      const budget = await service.create({ categoryId: 'cat-1', amount: 500, rollOver: false });

      await service.update(budget.id, { amount: 600, rollOver: true });

      const all = await service.list();
      expect(all).toHaveLength(1);
      expect(all[0].amount).toBe(600);
      expect(all[0].rollOver).toBe(true);
    });

    it('creates a new current-period version rather than rewriting a historical row', async () => {
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

      await service.update('historical-1', { amount: 450, rollOver: false });

      const all = await service.list();
      expect(all).toHaveLength(2);
      const original = all.find((b) => b.id === 'historical-1');
      const current = all.find((b) => b.id !== 'historical-1');
      expect(original?.amount).toBe(300); // untouched
      expect(current?.period).toBe(currentYearMonth());
      expect(current?.amount).toBe(450);
    });

    it('rejects a negative amount', async () => {
      await fakeDb['categories'].insert(seedCategory());
      const budget = await service.create({ categoryId: 'cat-1', amount: 500, rollOver: false });
      await expect(service.update(budget.id, { amount: -1, rollOver: false })).rejects.toThrow(
        'Budget amount must be greater than or equal to 0.',
      );
    });

    it('rejects turning on rollOver for an income budget', async () => {
      await fakeDb['categories'].insert(seedCategory({ id: 'paycheck', type: 'income' }));
      const budget = await service.create({ categoryId: 'paycheck', amount: 4000, rollOver: false });
      await expect(service.update(budget.id, { amount: 4000, rollOver: true })).rejects.toThrow(
        'Income budgets cannot roll over.',
      );
    });
  });

  describe('delete', () => {
    it('removes a budget', async () => {
      await fakeDb['categories'].insert(seedCategory());
      const budget = await service.create({ categoryId: 'cat-1', amount: 500, rollOver: false });

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
      await service.create({ categoryId: 'cat-1', amount: 500, rollOver: false });

      const result = await service.reconcileAndList();

      expect(result).toHaveLength(1);
    });
  });
});
