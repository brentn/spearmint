import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { categorizationRuleSchema, transactionSchema } from '../data/schemas';
import { DatabaseService } from '../data/database.service';
import type { CategorizationRule, Transaction } from '../data/models';
import { CategorizationSuggestionsService } from '../categorization/categorization-suggestions.service';
import { TransactionMutationService } from './transaction-mutation.service';

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

/**
 * Integration-tested against a real in-memory RxDB, following transactions.store.spec.ts's
 * existing pattern. This is where correction-recording/suggestion-dismissal logic moved to
 * (issue #19) — TransactionsStore/BudgetsStore specs now only assert delegation.
 */
describe('TransactionMutationService', () => {
  let fakeDb: RxDatabase;
  let service: TransactionMutationService;

  beforeEach(async () => {
    fakeDb = await createRxDatabase({
      name: `transaction-mutation-test-${Math.random().toString(36).slice(2)}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
    });
    await fakeDb.addCollections({
      transactions: { schema: transactionSchema },
      categorizationRules: { schema: categorizationRuleSchema },
    });

    TestBed.configureTestingModule({
      providers: [TransactionMutationService, { provide: DatabaseService, useValue: { getDatabase: () => Promise.resolve(fakeDb) } }],
    });
    service = TestBed.inject(TransactionMutationService);
  });

  afterEach(async () => {
    await fakeDb.remove();
  });

  describe('assignCategory', () => {
    it('patches a posted transaction', async () => {
      await fakeDb['transactions'].insert(seedTransaction());

      await service.assignCategory('txn-1', 'cat-1');

      const doc = await fakeDb['transactions'].findOne('txn-1').exec();
      expect(doc?.toJSON().categoryId).toBe('cat-1');
    });

    it('does not modify a pending transaction (locked from manual editing)', async () => {
      await fakeDb['transactions'].insert(seedTransaction({ pending: true }));

      await service.assignCategory('txn-1', 'cat-1');

      const doc = await fakeDb['transactions'].findOne('txn-1').exec();
      expect(doc?.toJSON().categoryId).toBeNull();
    });

    it('records a CategorizationRule correction from the transaction', async () => {
      await fakeDb['transactions'].insert(seedTransaction({ description: 'Starbucks', amount: -5, date: '2026-08-12' }));

      await service.assignCategory('txn-1', 'cat-1');

      const rules = await fakeDb['categorizationRules'].find().exec();
      expect(rules).toHaveLength(1);
      const rule: CategorizationRule = rules[0].toJSON();
      expect(rule.accountId).toBe('acc-1');
      expect(rule.normalizedDescription).toBe('STARBUCKS');
      expect(rule.categoryId).toBe('cat-1');
    });

    it('does not record a rule when clearing a category back to null', async () => {
      await fakeDb['transactions'].insert(seedTransaction({ categoryId: 'cat-1' }));

      await service.assignCategory('txn-1', null);

      const rules = await fakeDb['categorizationRules'].find().exec();
      expect(rules).toHaveLength(0);
    });

    it('clears any pending suggestion for the corrected transaction', async () => {
      const suggestions = TestBed.inject(CategorizationSuggestionsService);
      suggestions.set('txn-1', 'cat-2');
      await fakeDb['transactions'].insert(seedTransaction());

      await service.assignCategory('txn-1', 'cat-1');

      expect(suggestions.get('txn-1')).toBeNull();
    });
  });

  describe('setNotes', () => {
    it("patches a posted transaction's notes", async () => {
      await fakeDb['transactions'].insert(seedTransaction());

      await service.setNotes('txn-1', 'Reimbursed by roommate');

      const doc = await fakeDb['transactions'].findOne('txn-1').exec();
      expect(doc?.toJSON().notes).toBe('Reimbursed by roommate');
    });

    it('clears notes back to null', async () => {
      await fakeDb['transactions'].insert(seedTransaction({ notes: 'old note' }));

      await service.setNotes('txn-1', null);

      const doc = await fakeDb['transactions'].findOne('txn-1').exec();
      expect(doc?.toJSON().notes).toBeNull();
    });

    it('does not modify a pending transaction', async () => {
      await fakeDb['transactions'].insert(seedTransaction({ pending: true }));

      await service.setNotes('txn-1', 'note');

      const doc = await fakeDb['transactions'].findOne('txn-1').exec();
      expect(doc?.toJSON().notes).toBeNull();
    });
  });

  describe('setExcludeFromBudget', () => {
    it("patches a posted transaction's excludeFromBudget flag", async () => {
      await fakeDb['transactions'].insert(seedTransaction());

      await service.setExcludeFromBudget('txn-1', true);

      const doc = await fakeDb['transactions'].findOne('txn-1').exec();
      expect(doc?.toJSON().excludeFromBudget).toBe(true);
    });

    it('does not modify a pending transaction', async () => {
      await fakeDb['transactions'].insert(seedTransaction({ pending: true }));

      await service.setExcludeFromBudget('txn-1', true);

      const doc = await fakeDb['transactions'].findOne('txn-1').exec();
      expect(doc?.toJSON().excludeFromBudget).toBe(false);
    });
  });
});
