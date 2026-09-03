import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  accountMigrationStrategies,
  accountSchema,
  categorizationRuleSchema,
  categorySchema,
  transactionSchema,
} from '../../data/schemas';
import { DatabaseService } from '../../data/database.service';
import type { Account, CategorizationRule, Category, Transaction } from '../../data/models';
import { CategorizationSuggestionsService } from '../../categorization/categorization-suggestions.service';
import { TransactionMutationService } from '../../transactions/transaction-mutation.service';
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

function seedAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1',
    institutionId: 'org-1',
    connId: 'CON-1',
    externalAccountId: 'ext-1',
    originalAccountName: 'Checking',
    name: 'Checking',
    type: 'bank',
    currencyCode: 'USD',
    balance: 100,
    balanceDate: '2026-08-01',
    needsReconnect: false,
    syncIssue: null,
    missing: false,
    isManual: false,
    ...overrides,
  };
}

describe('TransactionsStore', () => {
  let fakeDb: RxDatabase;
  let store: TransactionsStore;
  let mutationService: {
    assignCategory: ReturnType<typeof vi.fn>;
    saveEdit: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    fakeDb = await createRxDatabase({
      name: `transactions-store-test-${Math.random().toString(36).slice(2)}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
    });
    await fakeDb.addCollections({
      transactions: { schema: transactionSchema },
      categories: { schema: categorySchema },
      accounts: { schema: accountSchema, migrationStrategies: accountMigrationStrategies },
      categorizationRules: { schema: categorizationRuleSchema },
    });

    mutationService = {
      assignCategory: vi.fn(async () => {}),
      saveEdit: vi.fn(async () => {}),
    };

    TestBed.configureTestingModule({
      providers: [
        TransactionsStore,
        { provide: DatabaseService, useValue: { getDatabase: () => Promise.resolve(fakeDb) } },
        { provide: TransactionMutationService, useValue: mutationService },
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

  it('accountName resolves a known account and falls back to an empty string', async () => {
    await fakeDb['accounts'].insert(seedAccount({ name: 'Checking' }));
    await store.refresh();

    expect(store.accountName('acc-1')).toBe('Checking');
    expect(store.accountName('missing')).toBe('');
  });

  it('assignCategory delegates to TransactionMutationService and refreshes', async () => {
    await fakeDb['transactions'].insert(seedTransaction());
    await store.refresh();

    await store.assignCategory('txn-1', 'cat-1');

    expect(mutationService.assignCategory).toHaveBeenCalledWith('txn-1', 'cat-1');
  });

  it('saveEdit delegates to TransactionMutationService in one call and refreshes', async () => {
    await fakeDb['transactions'].insert(seedTransaction());
    await store.refresh();

    await store.saveEdit('txn-1', { categoryId: 'cat-1', notes: 'Reimbursed by roommate', excludeFromBudget: true });

    expect(mutationService.saveEdit).toHaveBeenCalledWith('txn-1', {
      categoryId: 'cat-1',
      notes: 'Reimbursed by roommate',
      excludeFromBudget: true,
    });
  });

  describe('suggestions', () => {
    it('suggestionFor resolves the suggested category name', async () => {
      await fakeDb['categories'].insert(seedCategory({ id: 'cat-1', name: 'Groceries' }));
      await store.refresh();
      const suggestions = TestBed.inject(CategorizationSuggestionsService);
      suggestions.set('txn-1', 'cat-1');

      expect(store.suggestionFor('txn-1')).toEqual({ categoryId: 'cat-1', categoryName: 'Groceries' });
      expect(store.suggestionFor('txn-missing')).toBeNull();
    });

    it('acceptSuggestion applies the suggested category and clears the suggestion', async () => {
      await fakeDb['transactions'].insert(seedTransaction());
      await store.refresh();
      const suggestions = TestBed.inject(CategorizationSuggestionsService);
      suggestions.set('txn-1', 'cat-1');

      await store.acceptSuggestion('txn-1');

      expect(mutationService.assignCategory).toHaveBeenCalledWith('txn-1', 'cat-1');
    });

    it('recomputes a suggestion on refresh for an uncategorized transaction that lost it (e.g. across a reload)', async () => {
      await fakeDb['categorizationRules'].insert({
        id: 'rule-1',
        accountId: 'acc-1',
        normalizedDescription: 'TARGET STORE DOWNTOWN',
        amount: -40,
        dayOfMonth: 12,
        categoryId: 'cat-shopping',
        createdAtUtc: '2026-01-01T00:00:00.000Z',
        updatedAtUtc: '2026-01-01T00:00:00.000Z',
      } satisfies CategorizationRule);
      await fakeDb['transactions'].insert(
        seedTransaction({ description: 'Target Store Uptown Extra', amount: -40, date: '2026-08-12' }),
      );

      await store.refresh();

      const suggestions = TestBed.inject(CategorizationSuggestionsService);
      expect(suggestions.get('txn-1')).toBe('cat-shopping');
    });

    it('never recomputes a suggestion for a categorized or pending transaction', async () => {
      await fakeDb['categorizationRules'].insert({
        id: 'rule-1',
        accountId: 'acc-1',
        normalizedDescription: 'TARGET STORE DOWNTOWN',
        amount: -40,
        dayOfMonth: 12,
        categoryId: 'cat-shopping',
        createdAtUtc: '2026-01-01T00:00:00.000Z',
        updatedAtUtc: '2026-01-01T00:00:00.000Z',
      } satisfies CategorizationRule);
      await fakeDb['transactions'].insert(
        seedTransaction({
          id: 'txn-categorized',
          description: 'Target Store Uptown Extra',
          amount: -40,
          date: '2026-08-12',
          categoryId: 'cat-manual',
        }),
      );
      await fakeDb['transactions'].insert(
        seedTransaction({
          id: 'txn-pending',
          description: 'Target Store Uptown Extra',
          amount: -40,
          date: '2026-08-12',
          pending: true,
        }),
      );

      await store.refresh();

      const suggestions = TestBed.inject(CategorizationSuggestionsService);
      expect(suggestions.get('txn-categorized')).toBeNull();
      expect(suggestions.get('txn-pending')).toBeNull();
    });
  });
});
