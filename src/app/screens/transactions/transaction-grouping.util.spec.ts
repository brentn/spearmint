import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../data/models';
import { countInMonth, groupTransactionsByDay, totalSpentInMonth } from './transaction-grouping.util';

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
