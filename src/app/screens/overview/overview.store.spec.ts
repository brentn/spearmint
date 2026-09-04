import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { RxDatabase } from 'rxdb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../../data/database.service';
import { SimplefinSyncService } from '../../simplefin/simplefin-sync.service';
import { currentYearMonth } from '../../budgets/period.util';
import { seedAccount, seedTransaction } from '../../testing/fixtures';
import { createTestDatabase } from '../../testing/test-database';
import { OverviewStore } from './overview.store';

describe('OverviewStore', () => {
  let fakeDb: RxDatabase;
  let store: OverviewStore;

  beforeEach(async () => {
    fakeDb = await createTestDatabase('accounts', 'transactions');

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
