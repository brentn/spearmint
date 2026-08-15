import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { budgetSchema, categorySchema, transactionSchema } from '../data/schemas';
import { DatabaseService } from '../data/database.service';
import type { Budget, Category, Transaction } from '../data/models';
import { SimplefinSyncService } from '../simplefin/simplefin-sync.service';
import { currentYearMonth } from './period.util';
import { BudgetsStore } from './budgets.store';

function seedCategory(overrides: Partial<Category> = {}): Category {
  return { id: 'cat-1', name: 'Groceries', parentCategoryId: null, type: 'expense', ...overrides };
}

function seedBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-1',
    categoryId: 'cat-1',
    periodType: 'month',
    period: currentYearMonth(),
    rollOver: false,
    rolloverAmount: 0,
    amount: 500,
    ...overrides,
  };
}

function seedTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    accountId: 'acc-1',
    date: `${currentYearMonth()}-10`,
    description: 'Test',
    amount: -50,
    pending: false,
    categoryId: 'cat-1',
    excludeFromBudget: false,
    notes: null,
    ...overrides,
  };
}

describe('BudgetsStore', () => {
  let fakeDb: RxDatabase;
  let store: BudgetsStore;

  beforeEach(async () => {
    fakeDb = await createRxDatabase({
      name: `budgets-store-test-${Math.random().toString(36).slice(2)}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
    });
    await fakeDb.addCollections({
      budgets: { schema: budgetSchema },
      categories: { schema: categorySchema },
      transactions: { schema: transactionSchema },
    });

    TestBed.configureTestingModule({
      providers: [
        BudgetsStore,
        { provide: DatabaseService, useValue: { getDatabase: () => Promise.resolve(fakeDb) } },
        { provide: SimplefinSyncService, useValue: { syncing: () => false } },
      ],
    });
    store = TestBed.inject(BudgetsStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
  });

  afterEach(async () => {
    await fakeDb.remove();
  });

  it('starts empty when there are no budgets', () => {
    expect(store.rows()).toEqual([]);
  });

  it('builds a row with rollup spend and status for a budgeted category', async () => {
    await fakeDb['categories'].insert(seedCategory());
    await fakeDb['budgets'].insert(seedBudget({ amount: 100, rollOver: false }));
    await fakeDb['transactions'].insert(seedTransaction({ amount: -85 }));

    await store.refresh();

    expect(store.rows()).toHaveLength(1);
    const row = store.rows()[0];
    expect(row.categoryName).toBe('Groceries');
    expect(row.spent).toBe(85);
    expect(row.state).toBe('warning'); // 85%
  });

  it('carries a row\'s parentCategoryId from its category, null for top-level categories', async () => {
    await fakeDb['categories'].bulkInsert([
      seedCategory({ id: 'housing', name: 'Housing' }),
      seedCategory({ id: 'rent', name: 'Rent', parentCategoryId: 'housing' }),
    ]);
    await fakeDb['budgets'].bulkInsert([
      seedBudget({ id: 'b-housing', categoryId: 'housing', amount: 2000 }),
      seedBudget({ id: 'b-rent', categoryId: 'rent', amount: 1500 }),
    ]);

    await store.refresh();

    const housingRow = store.rows().find((r) => r.categoryId === 'housing');
    const rentRow = store.rows().find((r) => r.categoryId === 'rent');
    expect(housingRow?.parentCategoryId).toBeNull();
    expect(rentRow?.parentCategoryId).toBe('housing');
  });

  it('exposes the transactions it loaded for the current period', async () => {
    await fakeDb['categories'].insert(seedCategory());
    await fakeDb['transactions'].insert(seedTransaction());

    await store.refresh();

    expect(store.transactions().map((t) => t.id)).toEqual(['txn-1']);
  });

  it('rolls an unbudgeted child\'s spend up into a budgeted parent row', async () => {
    await fakeDb['categories'].bulkInsert([
      seedCategory({ id: 'housing', name: 'Housing' }),
      seedCategory({ id: 'rent', name: 'Rent', parentCategoryId: 'housing' }),
    ]);
    await fakeDb['budgets'].insert(seedBudget({ id: 'b-housing', categoryId: 'housing', amount: 2000 }));
    await fakeDb['transactions'].insert(seedTransaction({ categoryId: 'rent', amount: -1500 }));

    await store.refresh();

    expect(store.rows()).toHaveLength(1);
    expect(store.rows()[0].spent).toBe(1500);
  });

  it('categoriesWithoutCurrentBudget excludes already-budgeted categories', async () => {
    await fakeDb['categories'].bulkInsert([seedCategory({ id: 'cat-1' }), seedCategory({ id: 'cat-2', name: 'Dining' })]);
    await fakeDb['budgets'].insert(seedBudget({ categoryId: 'cat-1' }));

    await store.refresh();

    const available = store.categoriesWithoutCurrentBudget();
    expect(available.map((c) => c.id)).toEqual(['cat-2']);
  });

  it('addBudget creates a budget and refreshes rows', async () => {
    await fakeDb['categories'].insert(seedCategory());

    await store.addBudget('cat-1', 300, true);

    expect(store.rows()).toHaveLength(1);
    expect(store.rows()[0].amount).toBe(300);
  });

  it('addBudget surfaces a validation error without throwing', async () => {
    await store.addBudget('missing-category', 300, false);

    expect(store.error()).toBe('Category not found.');
    expect(store.rows()).toHaveLength(0);
  });

  it('updateBudget patches an existing budget and refreshes', async () => {
    await fakeDb['categories'].insert(seedCategory());
    await fakeDb['budgets'].insert(seedBudget({ amount: 100 }));
    await store.refresh();
    const id = store.rows()[0].id;

    await store.updateBudget(id, 250, false);

    expect(store.rows()[0].amount).toBe(250);
  });

  it('deleteBudget removes a budget and refreshes', async () => {
    await fakeDb['categories'].insert(seedCategory());
    await fakeDb['budgets'].insert(seedBudget());
    await store.refresh();
    const id = store.rows()[0].id;

    await store.deleteBudget(id);

    expect(store.rows()).toHaveLength(0);
  });

  describe('aggregate', () => {
    it('sums expense budgets only, excluding income from the spent-of-budgeted total', async () => {
      await fakeDb['categories'].bulkInsert([
        seedCategory({ id: 'cat-1', name: 'Groceries', type: 'expense' }),
        seedCategory({ id: 'paycheck', name: 'Paycheck', type: 'income' }),
      ]);
      await fakeDb['budgets'].bulkInsert([
        seedBudget({ id: 'b-1', categoryId: 'cat-1', amount: 500 }),
        seedBudget({ id: 'b-2', categoryId: 'paycheck', amount: 4000 }),
      ]);
      await fakeDb['transactions'].bulkInsert([
        seedTransaction({ id: 't-1', categoryId: 'cat-1', amount: -300 }),
        seedTransaction({ id: 't-2', categoryId: 'paycheck', amount: 3800 }),
      ]);

      await store.refresh();

      const aggregate = store.aggregate();
      expect(aggregate.totalBudget).toBe(500);
      expect(aggregate.totalSpent).toBe(300);
      expect(aggregate.remaining).toBe(200);
      expect(aggregate.earned).toBe(3800);
      expect(aggregate.cashFlowNet).toBe(3500);
    });
  });
});
