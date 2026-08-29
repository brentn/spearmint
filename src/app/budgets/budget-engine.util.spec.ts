import { describe, expect, it } from 'vitest';
import type { Budget, Category, Transaction } from '../data/models';
import {
  buildFlowProgressRow,
  buildSignedActualsMap,
  computeBudgetStatus,
  computeUncategorizedTotals,
  getBudgetForExactPeriod,
  getCombinedActualAmount,
  getCombinedBudgetAmounts,
  getDescendantCategories,
  getEffectiveBudgetForScope,
  getRollupActualAmount,
  recomputeRollovers,
} from './budget-engine.util';

function category(overrides: Partial<Category> = {}): Category {
  return { id: 'cat-1', name: 'Groceries', parentCategoryId: null, type: 'expense', ...overrides };
}

function txn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    accountId: 'acc-1',
    date: '2026-08-14',
    description: 'Test',
    amount: -50,
    pending: false,
    categoryId: 'cat-1',
    excludeFromBudget: false,
    notes: null,
    ...overrides,
  };
}

function budget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-1',
    categoryId: 'cat-1',
    periodType: 'month',
    period: '2026-08',
    rollOver: false,
    rolloverAmount: 0,
    amount: 500,
    ...overrides,
  };
}

describe('buildSignedActualsMap', () => {
  it('negates expense transaction amounts so spend is a positive number', () => {
    const categories = [category({ id: 'cat-1', type: 'expense' })];
    const transactions = [txn({ categoryId: 'cat-1', amount: -50, date: '2026-08-14' })];
    const map = buildSignedActualsMap(transactions, categories);
    expect(map.get('2026-08:cat-1')).toBe(50);
  });

  it('keeps income transaction amounts positive as earned', () => {
    const categories = [category({ id: 'cat-1', type: 'income' })];
    const transactions = [txn({ categoryId: 'cat-1', amount: 2000, date: '2026-08-01' })];
    const map = buildSignedActualsMap(transactions, categories);
    expect(map.get('2026-08:cat-1')).toBe(2000);
  });

  it('excludes transactions flagged excludeFromBudget', () => {
    const categories = [category({ id: 'cat-1', type: 'expense' })];
    const transactions = [txn({ categoryId: 'cat-1', amount: -50, excludeFromBudget: true })];
    const map = buildSignedActualsMap(transactions, categories);
    expect(map.get('2026-08:cat-1')).toBeUndefined();
  });

  it('excludes uncategorized transactions', () => {
    const categories = [category({ id: 'cat-1', type: 'expense' })];
    const transactions = [txn({ categoryId: null, amount: -50 })];
    const map = buildSignedActualsMap(transactions, categories);
    expect(map.size).toBe(0);
  });

  it('sums multiple transactions in the same period/category, including a refund', () => {
    const categories = [category({ id: 'cat-1', type: 'expense' })];
    const transactions = [
      txn({ id: 't1', categoryId: 'cat-1', amount: -60, date: '2026-08-05' }),
      txn({ id: 't2', categoryId: 'cat-1', amount: -40, date: '2026-08-20' }),
      txn({ id: 't3', categoryId: 'cat-1', amount: 15, date: '2026-08-22' }), // refund
    ];
    const map = buildSignedActualsMap(transactions, categories);
    expect(map.get('2026-08:cat-1')).toBe(85);
  });
});

describe('getBudgetForExactPeriod / getEffectiveBudgetForScope', () => {
  const budgets = [
    budget({ id: 'b-jan', period: '2026-01' }),
    budget({ id: 'b-mar', period: '2026-03' }),
  ];

  it('getBudgetForExactPeriod only matches an exact period', () => {
    expect(getBudgetForExactPeriod(budgets, 'cat-1', 'month', '2026-03')?.id).toBe('b-mar');
    expect(getBudgetForExactPeriod(budgets, 'cat-1', 'month', '2026-02')).toBeNull();
  });

  it('getEffectiveBudgetForScope returns the most recent budget at or before the target period', () => {
    expect(getEffectiveBudgetForScope(budgets, 'cat-1', 'month', '2026-02')?.id).toBe('b-jan');
    expect(getEffectiveBudgetForScope(budgets, 'cat-1', 'month', '2026-06')?.id).toBe('b-mar');
    expect(getEffectiveBudgetForScope(budgets, 'cat-1', 'month', '2025-12')).toBeNull();
  });
});

describe('getRollupActualAmount (carry-forward rollup fix)', () => {
  it('rolls an unbudgeted child\'s spend up into its budgeted parent', () => {
    const categories = [
      category({ id: 'housing', name: 'Housing', parentCategoryId: null }),
      category({ id: 'rent', name: 'Rent', parentCategoryId: 'housing' }),
      category({ id: 'utilities', name: 'Utilities', parentCategoryId: 'housing' }),
    ];
    const actuals = new Map([
      ['2026-08:rent', 1200],
      ['2026-08:utilities', 150],
    ]);
    const budgets = [budget({ id: 'b-housing', categoryId: 'housing', period: '2026-08' })];

    expect(getRollupActualAmount('2026-08', 'housing', categories, actuals, budgets)).toBe(1350);
  });

  it('stops at a budgeted descendant instead of double-counting its own envelope', () => {
    const categories = [
      category({ id: 'housing', name: 'Housing', parentCategoryId: null }),
      category({ id: 'rent', name: 'Rent', parentCategoryId: 'housing' }),
      category({ id: 'utilities', name: 'Utilities', parentCategoryId: 'housing' }),
    ];
    const actuals = new Map([
      ['2026-08:rent', 1200],
      ['2026-08:utilities', 150],
    ]);
    const budgets = [
      budget({ id: 'b-housing', categoryId: 'housing', period: '2026-08' }),
      budget({ id: 'b-rent', categoryId: 'rent', period: '2026-08' }), // Rent manages its own envelope
    ];

    // Housing's rollup should only pick up Utilities (unbudgeted) — Rent's 1200 stays in Rent's own row.
    expect(getRollupActualAmount('2026-08', 'housing', categories, actuals, budgets)).toBe(150);
    expect(getRollupActualAmount('2026-08', 'rent', categories, actuals, budgets)).toBe(1200);
  });

  it('uses the effective-as-of-that-period budgeted check, not "ever budgeted"', () => {
    const categories = [
      category({ id: 'housing', name: 'Housing', parentCategoryId: null }),
      category({ id: 'rent', name: 'Rent', parentCategoryId: 'housing' }),
    ];
    const actuals = new Map([['2026-06:rent', 1200]]);
    // Rent only became budgeted starting in August — its earlier (June) spend still rolls up to Housing.
    const budgets = [
      budget({ id: 'b-housing', categoryId: 'housing', period: '2026-01' }),
      budget({ id: 'b-rent', categoryId: 'rent', period: '2026-08' }),
    ];

    expect(getRollupActualAmount('2026-06', 'housing', categories, actuals, budgets)).toBe(1200);
  });

  it('recurses through multiple levels of unbudgeted descendants', () => {
    const categories = [
      category({ id: 'a', name: 'A', parentCategoryId: null }),
      category({ id: 'b', name: 'B', parentCategoryId: 'a' }),
      category({ id: 'c', name: 'C', parentCategoryId: 'b' }),
    ];
    const actuals = new Map([['2026-08:c', 75]]);
    const budgets = [budget({ id: 'b-a', categoryId: 'a', period: '2026-08' })];

    expect(getRollupActualAmount('2026-08', 'a', categories, actuals, budgets)).toBe(75);
  });
});

describe('getDescendantCategories', () => {
  it('returns children and grandchildren, generic over depth', () => {
    const categories = [
      category({ id: 'a', parentCategoryId: null }),
      category({ id: 'b', parentCategoryId: 'a' }),
      category({ id: 'c', parentCategoryId: 'b' }),
      category({ id: 'd', parentCategoryId: 'a' }),
    ];
    expect(getDescendantCategories('a', categories).map((c) => c.id).sort()).toEqual(['b', 'c', 'd']);
    expect(getDescendantCategories('c', categories)).toEqual([]);
  });
});

describe('getCombinedActualAmount (unified rollup rule)', () => {
  it('includes a budgeted descendant\'s spend too, unlike getRollupActualAmount', () => {
    const categories = [
      category({ id: 'housing', name: 'Housing', parentCategoryId: null }),
      category({ id: 'rent', name: 'Rent', parentCategoryId: 'housing' }),
      category({ id: 'utilities', name: 'Utilities', parentCategoryId: 'housing' }),
    ];
    const actuals = new Map([
      ['2026-08:rent', 1200],
      ['2026-08:utilities', 150],
      ['2026-08:housing', 20],
    ]);

    expect(getCombinedActualAmount('2026-08', 'housing', categories, actuals)).toBe(1370);
  });

  it('recurses through multiple levels', () => {
    const categories = [
      category({ id: 'a', parentCategoryId: null }),
      category({ id: 'b', parentCategoryId: 'a' }),
      category({ id: 'c', parentCategoryId: 'b' }),
    ];
    const actuals = new Map([['2026-08:c', 75]]);

    expect(getCombinedActualAmount('2026-08', 'a', categories, actuals)).toBe(75);
  });
});

describe('getCombinedBudgetAmounts (unified amount rule)', () => {
  it('is just the own budget for a leaf category with no descendants', () => {
    const categories = [category({ id: 'cat-1', parentCategoryId: null })];
    const budgets = [budget({ id: 'b-1', categoryId: 'cat-1', period: '2026-08', amount: 500, rolloverAmount: 40 })];

    const result = getCombinedBudgetAmounts('cat-1', categories, budgets, '2026-08');

    expect(result).toEqual({ amount: 500, rolloverAmount: 40, hasOwnBudget: true, hasBudgetedDescendant: false });
  });

  it('adds a budgeted child\'s amount/rollover onto the parent\'s own explicit budget', () => {
    const categories = [
      category({ id: 'housing', parentCategoryId: null }),
      category({ id: 'rent', parentCategoryId: 'housing' }),
    ];
    const budgets = [
      budget({ id: 'b-housing', categoryId: 'housing', period: '2026-08', amount: 300, rolloverAmount: 10 }),
      budget({ id: 'b-rent', categoryId: 'rent', period: '2026-08', amount: 1500, rolloverAmount: 50 }),
    ];

    const result = getCombinedBudgetAmounts('housing', categories, budgets, '2026-08');

    expect(result).toEqual({ amount: 1800, rolloverAmount: 60, hasOwnBudget: true, hasBudgetedDescendant: true });
  });

  it('is implied (zero own amount, hasOwnBudget false) when only a descendant is budgeted', () => {
    const categories = [
      category({ id: 'transportation', parentCategoryId: null }),
      category({ id: 'auto-payment', parentCategoryId: 'transportation' }),
    ];
    const budgets = [
      budget({ id: 'b-auto', categoryId: 'auto-payment', period: '2026-08', amount: 400, rolloverAmount: 0 }),
    ];

    const result = getCombinedBudgetAmounts('transportation', categories, budgets, '2026-08');

    expect(result).toEqual({ amount: 400, rolloverAmount: 0, hasOwnBudget: false, hasBudgetedDescendant: true });
  });

  it('has neither an own budget nor a budgeted descendant when nothing in the tree is budgeted', () => {
    const categories = [
      category({ id: 'transportation', parentCategoryId: null }),
      category({ id: 'gas', parentCategoryId: 'transportation' }),
    ];

    const result = getCombinedBudgetAmounts('transportation', categories, [], '2026-08');

    expect(result).toEqual({ amount: 0, rolloverAmount: 0, hasOwnBudget: false, hasBudgetedDescendant: false });
  });
});

describe('computeBudgetStatus', () => {
  it('expense: green below 85%', () => {
    expect(computeBudgetStatus('expense', 410, 500, 40).state).toBe('normal'); // 82%
  });

  it('expense: amber from 85% up to and including 100%', () => {
    expect(computeBudgetStatus('expense', 233, 250, 0).state).toBe('warning'); // 93.2%
    expect(computeBudgetStatus('expense', 100, 100, 0).state).toBe('warning'); // exactly 100%
  });

  it('expense: red over 100%', () => {
    expect(computeBudgetStatus('expense', 138, 100, 0).state).toBe('over'); // 138%
  });

  it('rollover counts toward the available-budget denominator', () => {
    // 410 / (500 + 40) = 75.9% -> normal, whereas 410/500 alone would be 82% (still normal here,
    // so use a case where rollover changes the bucket)
    const withoutRollover = computeBudgetStatus('expense', 430, 500, 0);
    const withRollover = computeBudgetStatus('expense', 430, 400, 100); // 430/500 = 86%
    expect(withoutRollover.percent).toBeCloseTo(0.86, 3);
    expect(withRollover.percent).toBeCloseTo(0.86, 3);
    expect(withRollover.state).toBe('warning');
  });

  it('income: inverted logic — green at/above target', () => {
    expect(computeBudgetStatus('income', 4200, 4200, 0).state).toBe('normal');
    expect(computeBudgetStatus('income', 5000, 4200, 0).state).toBe('normal');
  });

  it('income: amber approaching from below', () => {
    expect(computeBudgetStatus('income', 3200, 4200, 0).state).toBe('warning'); // ~76%
  });

  it('income: red well under target', () => {
    expect(computeBudgetStatus('income', 1000, 4200, 0).state).toBe('over'); // ~24%
  });

  it('barPercent clamps to 1 even when percent exceeds it', () => {
    expect(computeBudgetStatus('expense', 138, 100, 0).barPercent).toBe(1);
  });
});

describe('computeUncategorizedTotals', () => {
  it('sums a positive-amount uncategorized transaction as income', () => {
    const transactions = [txn({ categoryId: null, amount: 200, date: '2026-08-05' })];
    expect(computeUncategorizedTotals(transactions, '2026-08')).toEqual({ income: 200, expenses: 0 });
  });

  it('sums a negative-amount uncategorized transaction as a positive expense', () => {
    const transactions = [txn({ categoryId: null, amount: -75, date: '2026-08-05' })];
    expect(computeUncategorizedTotals(transactions, '2026-08')).toEqual({ income: 0, expenses: 75 });
  });

  it('excludes a categorized transaction', () => {
    const transactions = [txn({ categoryId: 'cat-1', amount: -75, date: '2026-08-05' })];
    expect(computeUncategorizedTotals(transactions, '2026-08')).toEqual({ income: 0, expenses: 0 });
  });

  it('excludes an uncategorized transaction flagged excludeFromBudget', () => {
    const transactions = [txn({ categoryId: null, amount: -75, date: '2026-08-05', excludeFromBudget: true })];
    expect(computeUncategorizedTotals(transactions, '2026-08')).toEqual({ income: 0, expenses: 0 });
  });

  it('excludes a transaction outside the given period', () => {
    const transactions = [txn({ categoryId: null, amount: -75, date: '2026-07-05' })];
    expect(computeUncategorizedTotals(transactions, '2026-08')).toEqual({ income: 0, expenses: 0 });
  });

  it('sums multiple uncategorized transactions of both signs', () => {
    const transactions = [
      txn({ id: 't1', categoryId: null, amount: 500, date: '2026-08-01' }),
      txn({ id: 't2', categoryId: null, amount: -30, date: '2026-08-10' }),
      txn({ id: 't3', categoryId: null, amount: -20, date: '2026-08-11' }),
    ];
    expect(computeUncategorizedTotals(transactions, '2026-08')).toEqual({ income: 500, expenses: 50 });
  });
});

describe('buildFlowProgressRow', () => {
  it('combines categorized and uncategorized actuals into totalActual', () => {
    const row = buildFlowProgressRow('expense', 300, 50, 500);
    expect(row.totalActual).toBe(350);
    expect(row.barPercent).toBeCloseTo(0.7, 5);
  });

  it('income is always the "info" state regardless of percent', () => {
    const under = buildFlowProgressRow('income', 100, 0, 4000);
    const over = buildFlowProgressRow('income', 5000, 0, 4000);
    expect(under.state).toBe('info');
    expect(over.state).toBe('info');
  });

  it('expenses use the normal/warning/over three-state against the combined actual', () => {
    expect(buildFlowProgressRow('expense', 400, 0, 500).state).toBe('normal'); // 80%
    expect(buildFlowProgressRow('expense', 400, 60, 500).state).toBe('warning'); // 92%
    expect(buildFlowProgressRow('expense', 400, 200, 500).state).toBe('over'); // 120%
  });

  it('a zero budget target forces a full-width bar', () => {
    const row = buildFlowProgressRow('expense', 40, 0, 0);
    expect(row.zeroBudget).toBe(true);
    expect(row.barPercent).toBe(1);
  });

  it('a zero-budget expense row with any spend is "over" (red) — matches the existing $0-budget row convention (issue #21)', () => {
    expect(buildFlowProgressRow('expense', 40, 0, 0).state).toBe('over');
  });

  it('a zero-budget expense row with no spend at all is "normal" (green), not "over"', () => {
    expect(buildFlowProgressRow('expense', 0, 0, 0).state).toBe('normal');
  });

  it('a zero-budget income row is still "info" (blue), not routed through normal/warning/over', () => {
    expect(buildFlowProgressRow('income', 40, 0, 0).state).toBe('info');
  });

  it('a non-zero budget clamps barPercent to 1 even over 100%', () => {
    const row = buildFlowProgressRow('expense', 600, 0, 500);
    expect(row.zeroBudget).toBe(false);
    expect(row.barPercent).toBe(1);
  });
});

describe('recomputeRollovers', () => {
  it('leaves budgets untouched when nothing has rollOver enabled', () => {
    const categories = [category({ id: 'cat-1' })];
    const budgets = [budget({ id: 'b-1', period: '2026-08', rollOver: false })];
    const result = recomputeRollovers(budgets, [], categories, '2026-08');
    expect(result.changedBudgetIds.size).toBe(0);
    expect(result.createdBudgets).toHaveLength(0);
  });

  it('carries unused budget forward into a newly-created next-period row', () => {
    const categories = [category({ id: 'cat-1' })];
    const budgets = [
      budget({ id: 'b-jul', period: '2026-07', amount: 500, rollOver: true, rolloverAmount: 0 }),
    ];
    const transactions = [txn({ categoryId: 'cat-1', amount: -300, date: '2026-07-10' })];

    const result = recomputeRollovers(budgets, transactions, categories, '2026-08');

    expect(result.createdBudgets).toHaveLength(1);
    const augustBudget = result.createdBudgets[0];
    expect(augustBudget.period).toBe('2026-08');
    expect(augustBudget.rolloverAmount).toBe(200); // 500 - 300
  });

  it('compounds rollover across multiple skipped months in one call', () => {
    const categories = [category({ id: 'cat-1' })];
    const budgets = [
      budget({ id: 'b-jun', period: '2026-06', amount: 500, rollOver: true, rolloverAmount: 0 }),
    ];
    const transactions = [
      txn({ id: 't-jun', categoryId: 'cat-1', amount: -300, date: '2026-06-10' }), // -> rollover into Jul: 200
      txn({ id: 't-jul', categoryId: 'cat-1', amount: -100, date: '2026-07-10' }), // available Jul = 700, actual 100 -> rollover into Aug: 600
    ];

    const result = recomputeRollovers(budgets, transactions, categories, '2026-08');

    const julyBudget = result.budgets.find((b) => b.period === '2026-07');
    const augustBudget = result.budgets.find((b) => b.period === '2026-08');
    expect(julyBudget?.rolloverAmount).toBe(200);
    expect(augustBudget?.rolloverAmount).toBe(600);
  });

  it('zeroes out an existing current-period rollover once the prior effective budget stops rolling over', () => {
    const categories = [category({ id: 'cat-1' })];
    const budgets = [
      budget({ id: 'b-jul', period: '2026-07', amount: 500, rollOver: false }),
      budget({ id: 'b-aug', period: '2026-08', amount: 500, rollOver: false, rolloverAmount: 150 }),
    ];

    const result = recomputeRollovers(budgets, [], categories, '2026-08');

    expect(result.changedBudgetIds.has('b-aug')).toBe(true);
    expect(result.budgets.find((b) => b.id === 'b-aug')?.rolloverAmount).toBe(0);
  });

  it('excludes income-typed categories from carry-forward entirely', () => {
    const categories = [category({ id: 'paycheck', name: 'Paycheck', type: 'income' })];
    const budgets = [
      budget({ id: 'b-jul', categoryId: 'paycheck', period: '2026-07', amount: 4000, rollOver: true }),
    ];
    const transactions = [txn({ categoryId: 'paycheck', amount: 3000, date: '2026-07-15' })];

    const result = recomputeRollovers(budgets, transactions, categories, '2026-08');

    expect(result.createdBudgets).toHaveLength(0);
    expect(result.changedBudgetIds.size).toBe(0);
  });

  it('a budgeted child does not have its spend double-counted into a rolling-over parent', () => {
    const categories = [
      category({ id: 'housing', name: 'Housing', parentCategoryId: null }),
      category({ id: 'rent', name: 'Rent', parentCategoryId: 'housing' }),
    ];
    const budgets = [
      budget({ id: 'b-housing-jul', categoryId: 'housing', period: '2026-07', amount: 200, rollOver: true }),
      budget({ id: 'b-rent-jul', categoryId: 'rent', period: '2026-07', amount: 1200, rollOver: false }),
    ];
    const transactions = [txn({ categoryId: 'rent', amount: -1200, date: '2026-07-01' })];

    const result = recomputeRollovers(budgets, transactions, categories, '2026-08');

    // Housing had no direct spend of its own and Rent manages its own envelope, so all $200 rolls forward.
    const housingAugust = result.createdBudgets.find((b) => b.categoryId === 'housing');
    expect(housingAugust?.rolloverAmount).toBe(200);
  });

  it('is idempotent when run twice with the same inputs', () => {
    const categories = [category({ id: 'cat-1' })];
    const budgets = [
      budget({ id: 'b-jul', period: '2026-07', amount: 500, rollOver: true, rolloverAmount: 0 }),
    ];
    const transactions = [txn({ categoryId: 'cat-1', amount: -300, date: '2026-07-10' })];

    const first = recomputeRollovers(budgets, transactions, categories, '2026-08');
    const second = recomputeRollovers(first.budgets, transactions, categories, '2026-08');

    expect(second.createdBudgets).toHaveLength(0);
    expect(second.changedBudgetIds.size).toBe(0);
  });
});
