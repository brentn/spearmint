import { TestBed } from '@angular/core/testing';
import type { RxDatabase } from 'rxdb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../data/database.service';
import type { Transaction } from '../data/models';
import { CategorizationSuggestionsService } from '../categorization/categorization-suggestions.service';
import { seedCategorizationRule, seedTransaction } from '../testing/fixtures';
import { createTestDatabase } from '../testing/test-database';
import { TransactionIngestionService } from './transaction-ingestion.service';

function seedDraft(overrides: Partial<Transaction> = {}): Transaction {
  return seedTransaction({ date: '2026-08-12', description: 'Coffee', amount: -5, ...overrides });
}

describe('TransactionIngestionService', () => {
  let fakeDb: RxDatabase;
  let service: TransactionIngestionService;

  beforeEach(async () => {
    fakeDb = await createTestDatabase('transactions', 'categorizationRules');

    TestBed.configureTestingModule({
      providers: [
        TransactionIngestionService,
        { provide: DatabaseService, useValue: { getDatabase: () => Promise.resolve(fakeDb) } },
      ],
    });
    service = TestBed.inject(TransactionIngestionService);
  });

  afterEach(async () => {
    await fakeDb.remove();
  });

  describe('categorizeAndInsert', () => {
    it('does nothing for an empty batch', async () => {
      const bulkInsert = vi.spyOn(fakeDb['transactions'], 'bulkInsert');

      await service.categorizeAndInsert('acc-1', []);

      expect(bulkInsert).not.toHaveBeenCalled();
    });

    it('auto-applies a category to a draft that confidently matches a stored rule', async () => {
      await fakeDb['categorizationRules'].insert(
        seedCategorizationRule({
          normalizedDescription: 'STARBUCKS',
          amount: -5,
          dayOfMonth: 12,
          categoryId: 'cat-coffee',
          createdAtUtc: '2026-01-01T00:00:00.000Z',
          updatedAtUtc: '2026-01-01T00:00:00.000Z',
        }),
      );

      await service.categorizeAndInsert('acc-1', [
        seedDraft({ id: 'txn-new', description: 'Starbucks', amount: -5, date: '2026-08-12' }),
      ]);

      const txn = await fakeDb['transactions'].findOne('txn-new').exec();
      expect(txn.categoryId).toBe('cat-coffee');
    });

    it('records a dismissible suggestion instead of auto-applying a mid-confidence match', async () => {
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

      await service.categorizeAndInsert('acc-1', [
        seedDraft({
          id: 'txn-new',
          description: 'Target Store Uptown Extra',
          amount: -40,
          date: '2026-08-12',
        }),
      ]);

      const txn = await fakeDb['transactions'].findOne('txn-new').exec();
      expect(txn.categoryId).toBeNull();
      const suggestions = TestBed.inject(CategorizationSuggestionsService);
      expect(suggestions.get('txn-new')).toBe('cat-shopping');
    });

    it('inserts a draft unchanged when no rule matches', async () => {
      await service.categorizeAndInsert('acc-1', [seedDraft({ id: 'txn-new' })]);

      const txn = await fakeDb['transactions'].findOne('txn-new').exec();
      expect(txn.categoryId).toBeNull();
      const suggestions = TestBed.inject(CategorizationSuggestionsService);
      expect(suggestions.get('txn-new')).toBeNull();
    });

    it('classifies each draft in a batch independently', async () => {
      await fakeDb['categorizationRules'].insert(
        seedCategorizationRule({
          normalizedDescription: 'STARBUCKS',
          amount: -5,
          dayOfMonth: 12,
          categoryId: 'cat-coffee',
          createdAtUtc: '2026-01-01T00:00:00.000Z',
          updatedAtUtc: '2026-01-01T00:00:00.000Z',
        }),
      );
      await fakeDb['categorizationRules'].insert(
        seedCategorizationRule({
          id: 'rule-2',
          normalizedDescription: 'TARGET STORE DOWNTOWN',
          amount: -40,
          dayOfMonth: 12,
          categoryId: 'cat-shopping',
          createdAtUtc: '2026-01-01T00:00:00.000Z',
          updatedAtUtc: '2026-01-01T00:00:00.000Z',
        }),
      );

      await service.categorizeAndInsert('acc-1', [
        seedDraft({ id: 'txn-auto', description: 'Starbucks', amount: -5, date: '2026-08-12' }),
        seedDraft({
          id: 'txn-suggest',
          description: 'Target Store Uptown Extra',
          amount: -40,
          date: '2026-08-12',
        }),
        seedDraft({
          id: 'txn-none',
          description: 'Unrelated Merchant',
          amount: -1,
          date: '2026-08-12',
        }),
      ]);

      const auto = await fakeDb['transactions'].findOne('txn-auto').exec();
      const suggest = await fakeDb['transactions'].findOne('txn-suggest').exec();
      const none = await fakeDb['transactions'].findOne('txn-none').exec();
      expect(auto.categoryId).toBe('cat-coffee');
      expect(suggest.categoryId).toBeNull();
      expect(none.categoryId).toBeNull();

      const suggestions = TestBed.inject(CategorizationSuggestionsService);
      expect(suggestions.get('txn-suggest')).toBe('cat-shopping');
      expect(suggestions.get('txn-auto')).toBeNull();
      expect(suggestions.get('txn-none')).toBeNull();
    });
  });
});
