import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { categorySchema, transactionSchema } from '../../data/schemas';
import { DatabaseService } from '../../data/database.service';
import type { Category, Transaction } from '../../data/models';
import { TransactionsStore } from './transactions.store';

function seedTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    accountId: 'acc-1',
    date: '2026-08-14',
    description: "Trader Joe's",
    amount: -64.2,
    pending: false,
    categoryId: null,
    excludeFromBudget: false,
    notes: null,
    ...overrides,
  };
}

function seedCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Groceries',
    parentCategoryId: null,
    type: 'expense',
    ...overrides,
  };
}

describe('TransactionsStore', () => {
  let fakeDb: RxDatabase;
  let store: TransactionsStore;

  beforeEach(async () => {
    fakeDb = await createRxDatabase({
      name: `transactions-store-test-${Math.random().toString(36).slice(2)}`,
      storage: getRxStorageMemory(),
    });
    await fakeDb.addCollections({
      transactions: { schema: transactionSchema },
      categories: { schema: categorySchema },
    });

    TestBed.configureTestingModule({
      providers: [
        TransactionsStore,
        { provide: DatabaseService, useValue: { getDatabase: () => Promise.resolve(fakeDb) } },
      ],
    });
    store = TestBed.inject(TransactionsStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
  });

  afterEach(async () => {
    await fakeDb.remove();
  });

  it('loads transactions and categories on construction', async () => {
    expect(store.transactions()).toEqual([]);
    expect(store.categories()).toEqual([]);
  });

  it('categoryName resolves a known category and falls back to Uncategorized', async () => {
    await fakeDb['categories'].insert(seedCategory());
    await store.refresh();

    expect(store.categoryName('cat-1')).toBe('Groceries');
    expect(store.categoryName(null)).toBe('Uncategorized');
    expect(store.categoryName('missing')).toBe('Uncategorized');
  });

  it('assignCategory patches a posted transaction and refreshes', async () => {
    await fakeDb['transactions'].insert(seedTransaction({ pending: false, categoryId: null }));
    await store.refresh();

    await store.assignCategory('txn-1', 'cat-1');

    expect(store.transactions()[0].categoryId).toBe('cat-1');
  });

  it('does not modify a pending transaction (locked from manual editing)', async () => {
    await fakeDb['transactions'].insert(seedTransaction({ pending: true, categoryId: null }));
    await store.refresh();

    await store.assignCategory('txn-1', 'cat-1');

    expect(store.transactions()[0].categoryId).toBeNull();
  });
});
