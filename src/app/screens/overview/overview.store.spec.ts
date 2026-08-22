import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountMigrationStrategies, accountSchema, transactionSchema } from '../../data/schemas';
import { DatabaseService } from '../../data/database.service';
import type { Account, Transaction } from '../../data/models';
import { SimplefinSyncService } from '../../simplefin/simplefin-sync.service';
import { currentYearMonth } from '../../budgets/period.util';
import { OverviewStore } from './overview.store';

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

function seedTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    accountId: 'acc-1',
    date: `${currentYearMonth()}-10`,
    description: 'Test',
    amount: -50,
    pending: false,
    categoryId: null,
    excludeFromBudget: false,
    notes: null,
    ...overrides,
  };
}

describe('OverviewStore', () => {
  let fakeDb: RxDatabase;
  let store: OverviewStore;

  beforeEach(async () => {
    fakeDb = await createRxDatabase({
      name: `overview-store-test-${Math.random().toString(36).slice(2)}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
    });
    await fakeDb.addCollections({
      accounts: { schema: accountSchema, migrationStrategies: accountMigrationStrategies },
      transactions: { schema: transactionSchema },
    });

    TestBed.configureTestingModule({
      providers: [
        OverviewStore,
        { provide: DatabaseService, useValue: { getDatabase: () => Promise.resolve(fakeDb) } },
        { provide: SimplefinSyncService, useValue: { syncing: signal(false) } },
      ],
    });
    store = TestBed.inject(OverviewStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
  });

  afterEach(async () => {
    await fakeDb.remove();
  });

  it('starts empty when there are no accounts', () => {
    expect(store.accounts()).toEqual([]);
    expect(store.totalBalance()).toBe(0);
  });

  it('sums balances across all accounts for the total', async () => {
    await fakeDb['accounts'].bulkInsert([
      seedAccount({ id: 'a1', balance: 3421.09 }),
      seedAccount({ id: 'a2', balance: 12894.5 }),
      seedAccount({ id: 'a3', type: 'creditCard', balance: -812.44 }),
    ]);

    await store.refresh();

    expect(store.totalBalance()).toBeCloseTo(15503.15);
  });

  it('aggregates balances separately by account type', async () => {
    await fakeDb['accounts'].bulkInsert([
      seedAccount({ id: 'a1', type: 'bank', balance: 3421.09 }),
      seedAccount({ id: 'a2', type: 'bank', balance: 12894.5 }),
      seedAccount({ id: 'a3', type: 'creditCard', balance: -812.44 }),
    ]);

    await store.refresh();

    expect(store.cashTotal()).toBeCloseTo(16315.59);
    expect(store.creditTotal()).toBeCloseTo(-812.44);
  });

  it('groups accounts by type, mirroring cashTotal/creditTotal', async () => {
    await fakeDb['accounts'].bulkInsert([
      seedAccount({ id: 'a1', type: 'bank', name: 'Checking' }),
      seedAccount({ id: 'a2', type: 'bank', name: 'Savings' }),
      seedAccount({ id: 'a3', type: 'creditCard', name: 'Visa' }),
    ]);

    await store.refresh();

    expect(store.cashAccounts().map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(store.creditAccounts().map((a) => a.id)).toEqual(['a3']);
  });

  it('flags attention-needed when an account needsReconnect', async () => {
    await fakeDb['accounts'].insert(seedAccount({ needsReconnect: true }));

    await store.refresh();

    expect(store.anyAccountNeedsAttention()).toBe(true);
  });

  it('flags attention-needed when an account has a syncIssue', async () => {
    await fakeDb['accounts'].insert(seedAccount({ syncIssue: 'auth error' }));

    await store.refresh();

    expect(store.anyAccountNeedsAttention()).toBe(true);
  });

  it('flags attention-needed when an account is missing', async () => {
    await fakeDb['accounts'].insert(seedAccount({ missing: true }));

    await store.refresh();

    expect(store.anyAccountNeedsAttention()).toBe(true);
  });

  it('does not flag attention-needed when every account is healthy', async () => {
    await fakeDb['accounts'].insert(seedAccount());

    await store.refresh();

    expect(store.anyAccountNeedsAttention()).toBe(false);
  });

  it('exposes uncategorized transactions', async () => {
    await fakeDb['transactions'].bulkInsert([
      seedTransaction({ id: 't1', categoryId: null }),
      seedTransaction({ id: 't2', categoryId: 'cat-1' }),
      seedTransaction({ id: 't3', categoryId: null }),
    ]);

    await store.refresh();

    expect(store.uncategorizedTransactions().map((t) => t.id)).toEqual(['t1', 't3']);
  });

  it('computes the net balance change from this month\'s transactions only', async () => {
    await fakeDb['transactions'].bulkInsert([
      seedTransaction({ id: 't1', date: `${currentYearMonth()}-05`, amount: -64.2 }),
      seedTransaction({ id: 't2', date: `${currentYearMonth()}-10`, amount: 2104.55 }),
      seedTransaction({ id: 't3', date: '2020-01-01', amount: -9000 }),
    ]);

    await store.refresh();

    expect(store.balanceDeltaThisMonth()).toBeCloseTo(2040.35);
  });
});
