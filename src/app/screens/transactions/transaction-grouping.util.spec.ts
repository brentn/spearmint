import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '../../data/models';
import {
  countInMonth,
  filterByAccount,
  filterBySearch,
  filterUncategorized,
  groupTransactionsByDay,
  netChangeInMonth,
  totalSpentInMonth,
} from './transaction-grouping.util';

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    accountId: 'acc-1',
    date: '2026-08-14',
    description: 'Trader Joe\'s',
    amount: -64.2,
    pending: false,
    categoryId: null,
    excludeFromBudget: false,
    notes: null,
    ...overrides,
  };
}

describe('groupTransactionsByDay', () => {
  it('groups transactions under their date, newest date first', () => {
    const transactions = [
      transaction({ id: 't1', date: '2026-08-11' }),
      transaction({ id: 't2', date: '2026-08-14' }),
      transaction({ id: 't3', date: '2026-08-11' }),
    ];

    const groups = groupTransactionsByDay(transactions, '2026-08-14');

    expect(groups.map((g) => g.date)).toEqual(['2026-08-14', '2026-08-11']);
    expect(groups[1].transactions.map((t) => t.id)).toEqual(['t1', 't3']);
  });

  it('labels the current day "Today" and the prior day "Yesterday"', () => {
    const transactions = [
      transaction({ id: 't1', date: '2026-08-14' }),
      transaction({ id: 't2', date: '2026-08-13' }),
      transaction({ id: 't3', date: '2026-08-11' }),
    ];

    const groups = groupTransactionsByDay(transactions, '2026-08-14');

    expect(groups[0].heading).toBe('Today');
    expect(groups[1].heading).toBe('Yesterday');
    expect(groups[2].heading).not.toBe('Yesterday');
  });

  it('formats other dates as a short month/day label', () => {
    const transactions = [transaction({ id: 't1', date: '2026-08-11' })];

    const groups = groupTransactionsByDay(transactions, '2026-08-14');

    expect(groups[0].heading).toBe('Aug 11');
  });

  it('returns an empty array for no transactions', () => {
    expect(groupTransactionsByDay([], '2026-08-14')).toEqual([]);
  });
});

describe('totalSpentInMonth', () => {
  it('sums the absolute value of negative-amount transactions within the given month', () => {
    const transactions = [
      transaction({ date: '2026-08-14', amount: -64.2 }),
      transaction({ date: '2026-08-01', amount: -10 }),
      transaction({ date: '2026-07-31', amount: -500 }),
    ];

    expect(totalSpentInMonth(transactions, '2026-08')).toBeCloseTo(74.2);
  });

  it('excludes deposits (positive amounts) from the total', () => {
    const transactions = [
      transaction({ date: '2026-08-14', amount: -64.2 }),
      transaction({ date: '2026-08-13', amount: 2104.55 }),
    ];

    expect(totalSpentInMonth(transactions, '2026-08')).toBeCloseTo(64.2);
  });

  it('is zero when there is nothing in the month', () => {
    expect(totalSpentInMonth([], '2026-08')).toBe(0);
  });
});

describe('countInMonth', () => {
  it('counts every transaction dated within the given month, spend or deposit', () => {
    const transactions = [
      transaction({ date: '2026-08-14', amount: -64.2 }),
      transaction({ date: '2026-08-13', amount: 2104.55 }),
      transaction({ date: '2026-07-31', amount: -1 }),
    ];

    expect(countInMonth(transactions, '2026-08')).toBe(2);
  });
});

describe('filterUncategorized', () => {
  it('keeps only transactions with no categoryId', () => {
    const transactions = [
      transaction({ id: 't1', categoryId: 'cat-1' }),
      transaction({ id: 't2', categoryId: null }),
      transaction({ id: 't3', categoryId: null }),
    ];

    expect(filterUncategorized(transactions).map((t) => t.id)).toEqual(['t2', 't3']);
  });

  it('is empty when nothing is uncategorized', () => {
    expect(filterUncategorized([transaction({ categoryId: 'cat-1' })])).toEqual([]);
  });
});

describe('filterByAccount', () => {
  it('keeps only transactions matching the given accountId', () => {
    const transactions = [
      transaction({ id: 't1', accountId: 'acc-1' }),
      transaction({ id: 't2', accountId: 'acc-2' }),
      transaction({ id: 't3', accountId: 'acc-1' }),
    ];

    expect(filterByAccount(transactions, 'acc-1').map((t) => t.id)).toEqual(['t1', 't3']);
  });

  it('is empty when no transactions match the account', () => {
    expect(filterByAccount([transaction({ accountId: 'acc-1' })], 'acc-2')).toEqual([]);
  });
});

describe('filterBySearch', () => {
  const categories: Category[] = [{ id: 'cat-1', name: 'Groceries', type: 'expense', parentCategoryId: null }];
  const today = '2026-08-14';

  it('returns every transaction unchanged when the query is empty or whitespace', () => {
    const transactions = [transaction({ id: 't1' }), transaction({ id: 't2' })];

    expect(filterBySearch(transactions, '', categories, today).map((t) => t.id)).toEqual(['t1', 't2']);
    expect(filterBySearch(transactions, '   ', categories, today).map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('matches on description, case-insensitively', () => {
    const transactions = [
      transaction({ id: 't1', description: "Trader Joe's" }),
      transaction({ id: 't2', description: 'Shell Gas Station' }),
    ];

    expect(filterBySearch(transactions, 'trader', categories, today).map((t) => t.id)).toEqual(['t1']);
  });

  it('matches on notes', () => {
    const transactions = [
      transaction({ id: 't1', notes: 'split with roommate' }),
      transaction({ id: 't2', notes: null }),
    ];

    expect(filterBySearch(transactions, 'roommate', categories, today).map((t) => t.id)).toEqual(['t1']);
  });

  it('matches on the raw stored date', () => {
    const transactions = [transaction({ id: 't1', date: '2026-08-14' }), transaction({ id: 't2', date: '2026-08-01' })];

    expect(filterBySearch(transactions, '08-14', categories, today).map((t) => t.id)).toEqual(['t1']);
  });

  it('matches on the date as displayed in the list ("Today"/"Yesterday"/short month-day)', () => {
    const transactions = [
      transaction({ id: 't1', date: '2026-08-14' }), // today
      transaction({ id: 't2', date: '2026-08-13' }), // yesterday
      transaction({ id: 't3', date: '2026-08-11' }), // "Aug 11"
    ];

    expect(filterBySearch(transactions, 'today', categories, today).map((t) => t.id)).toEqual(['t1']);
    expect(filterBySearch(transactions, 'yesterday', categories, today).map((t) => t.id)).toEqual(['t2']);
    expect(filterBySearch(transactions, 'aug 11', categories, today).map((t) => t.id)).toEqual(['t3']);
  });

  it('matches on category name', () => {
    const transactions = [
      transaction({ id: 't1', categoryId: 'cat-1' }),
      transaction({ id: 't2', categoryId: null }),
    ];

    expect(filterBySearch(transactions, 'grocer', categories, today).map((t) => t.id)).toEqual(['t1']);
  });

  it('matches an uncategorized transaction by searching "uncategorized"', () => {
    const transactions = [transaction({ id: 't1', categoryId: null }), transaction({ id: 't2', categoryId: 'cat-1' })];

    expect(filterBySearch(transactions, 'uncategorized', categories, today).map((t) => t.id)).toEqual(['t1']);
  });

  it('matches on amount, ignoring sign', () => {
    const transactions = [transaction({ id: 't1', amount: -64.2 }), transaction({ id: 't2', amount: 12.5 })];

    expect(filterBySearch(transactions, '64.2', categories, today).map((t) => t.id)).toEqual(['t1']);
  });

  it('is empty when nothing matches', () => {
    expect(filterBySearch([transaction()], 'nonexistent', categories, today)).toEqual([]);
  });
});

describe('netChangeInMonth', () => {
  it('sums signed amounts within the given month, deposits and spend netted together', () => {
    const transactions = [
      transaction({ date: '2026-08-14', amount: -64.2 }),
      transaction({ date: '2026-08-13', amount: 2104.55 }),
      transaction({ date: '2026-07-31', amount: -500 }),
    ];

    expect(netChangeInMonth(transactions, '2026-08')).toBeCloseTo(2040.35);
  });

  it('is zero when there is nothing in the month', () => {
    expect(netChangeInMonth([], '2026-08')).toBe(0);
  });
});
