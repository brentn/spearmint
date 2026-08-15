import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { categorizationRuleSchema } from '../data/schemas';
import { DatabaseService } from '../data/database.service';
import type { CategorizationRule } from '../data/models';
import { CategorizationRulesService } from './categorization-rules.service';

describe('CategorizationRulesService', () => {
  let fakeDb: RxDatabase;
  let service: CategorizationRulesService;

  beforeEach(async () => {
    fakeDb = await createRxDatabase({
      name: `categorization-rules-test-${Math.random().toString(36).slice(2)}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
    });
    await fakeDb.addCollections({ categorizationRules: { schema: categorizationRuleSchema } });

    TestBed.configureTestingModule({
      providers: [
        CategorizationRulesService,
        { provide: DatabaseService, useValue: { getDatabase: () => Promise.resolve(fakeDb) } },
      ],
    });
    service = TestBed.inject(CategorizationRulesService);
  });

  afterEach(async () => {
    await fakeDb.remove();
  });

  describe('recordCorrection', () => {
    it('creates a new rule from a correction', async () => {
      await service.recordCorrection(
        { id: 'txn-1', accountId: 'acc-1', description: 'Starbucks Store #123', amount: -5.5, date: '2026-08-12' },
        'cat-coffee',
      );

      const rules = await fakeDb['categorizationRules'].find().exec();
      expect(rules).toHaveLength(1);
      const rule: CategorizationRule = rules[0].toJSON();
      expect(rule.accountId).toBe('acc-1');
      expect(rule.normalizedDescription).toBe('STARBUCKS STORE 123');
      expect(rule.amount).toBe(-5.5);
      expect(rule.dayOfMonth).toBe(12);
      expect(rule.categoryId).toBe('cat-coffee');
      expect(rule.createdAtUtc).toBe(rule.updatedAtUtc);
    });

    it('updates the existing rule instead of duplicating when the fingerprint repeats', async () => {
      await service.recordCorrection(
        { id: 'txn-1', accountId: 'acc-1', description: 'Starbucks', amount: -5, date: '2026-08-12' },
        'cat-coffee',
      );
      await service.recordCorrection(
        { id: 'txn-2', accountId: 'acc-1', description: 'Starbucks', amount: -6, date: '2026-08-14' },
        'cat-dining',
      );

      const rules = await fakeDb['categorizationRules'].find().exec();
      expect(rules).toHaveLength(1);
      const rule: CategorizationRule = rules[0].toJSON();
      expect(rule.amount).toBe(-6);
      expect(rule.dayOfMonth).toBe(14);
      expect(rule.categoryId).toBe('cat-dining');
    });

    it('keeps rules for the same normalized description on different accounts separate', async () => {
      await service.recordCorrection(
        { id: 'txn-1', accountId: 'acc-1', description: 'Coffee Shop', amount: -5, date: '2026-08-01' },
        'cat-a',
      );
      await service.recordCorrection(
        { id: 'txn-2', accountId: 'acc-2', description: 'Coffee Shop', amount: -5, date: '2026-08-01' },
        'cat-b',
      );

      const rules = await fakeDb['categorizationRules'].find().exec();
      expect(rules).toHaveLength(2);
    });
  });

  describe('classifyMany', () => {
    it('returns no-match outcomes when there are no stored rules', async () => {
      const outcomes = await service.classifyMany('acc-1', [
        { id: 'txn-1', accountId: 'acc-1', description: 'Anything', amount: -1, date: '2026-08-01' },
      ]);

      expect(outcomes.get('txn-1')).toEqual({ tier: 'none', categoryId: null, ruleId: null });
    });

    it('auto-applies against a stored rule fetched once for the account', async () => {
      await service.recordCorrection(
        { id: 'txn-seed', accountId: 'acc-1', description: 'Starbucks', amount: -5, date: '2026-08-10' },
        'cat-coffee',
      );

      const outcomes = await service.classifyMany('acc-1', [
        { id: 'txn-1', accountId: 'acc-1', description: 'Starbucks', amount: -5, date: '2026-08-10' },
        { id: 'txn-2', accountId: 'acc-1', description: 'Starbucks', amount: -5, date: '2026-08-10' },
      ]);

      expect(outcomes.get('txn-1')?.tier).toBe('auto');
      expect(outcomes.get('txn-1')?.categoryId).toBe('cat-coffee');
      expect(outcomes.get('txn-2')?.tier).toBe('auto');
    });

    it('never matches a rule stored under a different account', async () => {
      await service.recordCorrection(
        { id: 'txn-seed', accountId: 'acc-other', description: 'Starbucks', amount: -5, date: '2026-08-10' },
        'cat-coffee',
      );

      const outcomes = await service.classifyMany('acc-1', [
        { id: 'txn-1', accountId: 'acc-1', description: 'Starbucks', amount: -5, date: '2026-08-10' },
      ]);

      expect(outcomes.get('txn-1')).toEqual({ tier: 'none', categoryId: null, ruleId: null });
    });
  });
});
