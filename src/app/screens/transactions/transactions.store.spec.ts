import { TestBed } from '@angular/core/testing';
import type { RxDatabase } from 'rxdb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../../data/database.service';
import { CategorizationSuggestionsService } from '../../categorization/categorization-suggestions.service';
import { TransactionMutationService } from '../../transactions/transaction-mutation.service';
import {
  seedAccount,
  seedCategorizationRule,
  seedCategory,
  seedTransaction,
} from '../../testing/fixtures';
import { createTestDatabase } from '../../testing/test-database';
import { TransactionsStore } from './transactions.store';

describe('TransactionsStore', () => {
  let fakeDb: RxDatabase;
  let store: TransactionsStore;
  let mutationService: {
    assignCategory: ReturnType<typeof vi.fn>;
    saveEdit: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    fakeDb = await createTestDatabase(
      'transactions',
      'categories',
      'accounts',
      'categorizationRules',
    );

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

    await store.saveEdit('txn-1', {
      categoryId: 'cat-1',
      notes: 'Reimbursed by roommate',
      excludeFromBudget: true,
    });

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

      expect(store.suggestionFor('txn-1')).toEqual({
        categoryId: 'cat-1',
        categoryName: 'Groceries',
      });
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
      await fakeDb['categorizationRules'].insert(
        seedCategorizationRule({
          normalizedDescription: 'TARGET STORE DOWNTOWN',
          amount: -40,
          dayOfMonth: 12,
          categoryId: 'cat-shopping',
          createdAtUtc: '2026-01-01T00:00:00.000Z',
          updatedAtUtc: '2026-01-01T00:00:00.000Z',
        }),
      );
      await fakeDb['transactions'].insert(
        seedTransaction({
          description: 'Target Store Uptown Extra',
          amount: -40,
          date: '2026-08-12',
        }),
      );

      await store.refresh();

      const suggestions = TestBed.inject(CategorizationSuggestionsService);
      expect(suggestions.get('txn-1')).toBe('cat-shopping');
    });

    it('never recomputes a suggestion for a categorized or pending transaction', async () => {
      await fakeDb['categorizationRules'].insert(
        seedCategorizationRule({
          normalizedDescription: 'TARGET STORE DOWNTOWN',
          amount: -40,
          dayOfMonth: 12,
          categoryId: 'cat-shopping',
          createdAtUtc: '2026-01-01T00:00:00.000Z',
          updatedAtUtc: '2026-01-01T00:00:00.000Z',
        }),
      );
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
