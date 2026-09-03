import { describe, expect, it } from 'vitest';
import type { Budget, Category, Transaction, YearMonth } from '../data/models';
import {
  type BudgetPeriodView,
  computeBudgetPeriodView,
  getBudgetForExactPeriod,
  getDescendantCategories,
  getEnvelopeActualAmount,
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

/** computeBudgetPeriodView is the interface every scenario below goes through — `monthPhrase` is
 * irrelevant to every assertion here (it only feeds `aggregate.message`), so it's fixed to one
 * value throughout. */
function view(
  categories: Category[],
  budgets: Budget[],
  transactions: Transaction[],
  period: YearMonth = '2026-08',
): BudgetPeriodView {
  return computeBudgetPeriodView(budgets, categories, transactions, period, 'this month');
}

function rowFor(v: BudgetPeriodView, categoryId: string) {
  return v.rows.find((r) => r.categoryId === categoryId);
}

/** A single-category row scenario for computeBudgetStatus's threshold/rollover/reversed-bar
 * behavior. `period` defaults to a period safely in the past so an income category's row never
 * hits the pre-final-week 'info' override (period.util's isFinalWeekOfMonth treats any period
 * before the real current month as final-week, unconditionally). */
function statusRow(
  categoryType: 'expense' | 'income',
  spent: number,
  amount: number,
  rolloverAmount = 0,
  period: YearMonth = '2020-01',
) {
  const categories = [category({ id: 'cat-1', type: categoryType })];
  const budgets = [budget({ id: 'b-1', categoryId: 'cat-1', period, amount, rolloverAmount })];
  const rawAmount = categoryType === 'income' ? spent : -spent;
  const transactions = spent === 0 ? [] : [txn({ categoryId: 'cat-1', amount: rawAmount, date: `${period}-14` })];
  const row = rowFor(view(categories, budgets, transactions, period), 'cat-1');
  if (!row) {
    throw new Error('expected a row for cat-1');
  }
  return row;
}

describe('computeBudgetPeriodView — signed actuals (spend vs. earned)', () => {
  it('negates expense transaction amounts so spent is a positive number', () => {
    const categories = [category({ id: 'cat-1', type: 'expense' })];
    const budgets = [budget({ id: 'b-1', categoryId: 'cat-1', amount: 500 })];
    const transactions = [txn({ categoryId: 'cat-1', amount: -50, date: '2026-08-14' })];
    expect(rowFor(view(categories, budgets, transactions), 'cat-1')?.spent).toBe(50);
  });

  it('keeps income transaction amounts positive as earned', () => {
    const categories = [category({ id: 'cat-1', type: 'income' })];
    const budgets = [budget({ id: 'b-1', categoryId: 'cat-1', amount: 4000 })];
    const transactions = [txn({ categoryId: 'cat-1', amount: 2000, date: '2026-08-01' })];
    expect(rowFor(view(categories, budgets, transactions), 'cat-1')?.spent).toBe(2000);
  });

  it('excludes transactions flagged excludeFromBudget', () => {
    const categories = [category({ id: 'cat-1', type: 'expense' })];
    const budgets = [budget({ id: 'b-1', categoryId: 'cat-1', amount: 500 })];
    const transactions = [txn({ categoryId: 'cat-1', amount: -50, excludeFromBudget: true })];
    expect(rowFor(view(categories, budgets, transactions), 'cat-1')?.spent).toBe(0);
  });

  it('excludes uncategorized transactions from every category row, but still counts them in flow-progress', () => {
    const categories = [category({ id: 'cat-1', type: 'expense' })];
    const budgets = [budget({ id: 'b-1', categoryId: 'cat-1', amount: 500 })];
    const transactions = [txn({ categoryId: null, amount: -50, date: '2026-08-14' })];
    const v = view(categories, budgets, transactions);
    expect(rowFor(v, 'cat-1')?.spent).toBe(0);
    expect(v.flowProgress.expenses.uncategorizedActual).toBe(50);
  });

  it('sums multiple transactions in the same period/category, including a refund', () => {
    const categories = [category({ id: 'cat-1', type: 'expense' })];
    const budgets = [budget({ id: 'b-1', categoryId: 'cat-1', amount: 500 })];
    const transactions = [
      txn({ id: 't1', categoryId: 'cat-1', amount: -60, date: '2026-08-05' }),
      txn({ id: 't2', categoryId: 'cat-1', amount: -40, date: '2026-08-20' }),
      txn({ id: 't3', categoryId: 'cat-1', amount: 15, date: '2026-08-22' }), // refund
    ];
    expect(rowFor(view(categories, budgets, transactions), 'cat-1')?.spent).toBe(85);
  });
});

describe('getBudgetForExactPeriod', () => {
  it('only matches an exact period', () => {
    const budgets = [budget({ id: 'b-jan', period: '2026-01' }), budget({ id: 'b-mar', period: '2026-03' })];
    expect(getBudgetForExactPeriod(budgets, 'cat-1', '2026-03')?.id).toBe('b-mar');
    expect(getBudgetForExactPeriod(budgets, 'cat-1', '2026-02')).toBeNull();
  });
});

describe('computeBudgetPeriodView — effective budget scope (most recent at-or-before period)', () => {
  it('a category with only an earlier budget still shows that budget when viewed later', () => {
    const categories = [category({ id: 'cat-1' })];
    const budgets = [budget({ id: 'b-jan', period: '2026-01', amount: 500 })];
    expect(rowFor(view(categories, budgets, [], '2026-06'), 'cat-1')?.amount).toBe(500);
  });

  it('picks up the most recent budget at or before the viewed period, not an earlier one', () => {
    const categories = [category({ id: 'cat-1' })];
    const budgets = [
      budget({ id: 'b-jan', period: '2026-01', amount: 500 }),
      budget({ id: 'b-mar', period: '2026-03', amount: 800 }),
    ];
    expect(rowFor(view(categories, budgets, [], '2026-06'), 'cat-1')?.amount).toBe(800);
  });

  it('a category with no budget at or before the viewed period, and no activity, gets no row at all', () => {
    const categories = [category({ id: 'cat-1' })];
    const budgets = [budget({ id: 'b-mar', period: '2026-03', amount: 500 })];
    expect(rowFor(view(categories, budgets, [], '2026-01'), 'cat-1')).toBeUndefined();
  });
});

describe('getEnvelopeActualAmount (rollover engine own-envelope math)', () => {
  it("rolls an unbudgeted child's spend up into its budgeted parent", () => {
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

    expect(getEnvelopeActualAmount('2026-08', 'housing', categories, actuals, budgets)).toBe(1350);
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
    expect(getEnvelopeActualAmount('2026-08', 'housing', categories, actuals, budgets)).toBe(150);
    expect(getEnvelopeActualAmount('2026-08', 'rent', categories, actuals, budgets)).toBe(1200);
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

    expect(getEnvelopeActualAmount('2026-06', 'housing', categories, actuals, budgets)).toBe(1200);
  });

  it('recurses through multiple levels of unbudgeted descendants', () => {
    const categories = [
      category({ id: 'a', name: 'A', parentCategoryId: null }),
      category({ id: 'b', name: 'B', parentCategoryId: 'a' }),
      category({ id: 'c', name: 'C', parentCategoryId: 'b' }),
    ];
    const actuals = new Map([['2026-08:c', 75]]);
    const budgets = [budget({ id: 'b-a', categoryId: 'a', period: '2026-08' })];

    expect(getEnvelopeActualAmount('2026-08', 'a', categories, actuals, budgets)).toBe(75);
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
    expect(
      getDescendantCategories('a', categories)
        .map((c) => c.id)
        .sort(),
    ).toEqual(['b', 'c', 'd']);
    expect(getDescendantCategories('c', categories)).toEqual([]);
  });
});

describe('computeBudgetPeriodView — combined actual (full-subtree rollup)', () => {
  it("a parent's spent includes a budgeted descendant's spend too", () => {
    const categories = [
      category({ id: 'housing', name: 'Housing', parentCategoryId: null }),
      category({ id: 'rent', name: 'Rent', parentCategoryId: 'housing' }),
      category({ id: 'utilities', name: 'Utilities', parentCategoryId: 'housing' }),
    ];
    const budgets = [
      budget({ id: 'b-housing', categoryId: 'housing', amount: 300 }),
      budget({ id: 'b-rent', categoryId: 'rent', amount: 1500 }),
    ];
    const transactions = [
      txn({ id: 't-rent', categoryId: 'rent', amount: -1200, date: '2026-08-05' }),
      txn({ id: 't-util', categoryId: 'utilities', amount: -150, date: '2026-08-05' }),
      txn({ id: 't-housing', categoryId: 'housing', amount: -20, date: '2026-08-05' }),
    ];
    expect(rowFor(view(categories, budgets, transactions), 'housing')?.spent).toBe(1370);
  });

  it('recurses through multiple levels', () => {
    const categories = [
      category({ id: 'a', parentCategoryId: null }),
      category({ id: 'b', parentCategoryId: 'a' }),
      category({ id: 'c', parentCategoryId: 'b' }),
    ];
    const budgets = [budget({ id: 'b-a', categoryId: 'a', amount: 100 })];
    const transactions = [txn({ categoryId: 'c', amount: -75, date: '2026-08-05' })];
    expect(rowFor(view(categories, budgets, transactions), 'a')?.spent).toBe(75);
  });
});

describe('computeBudgetPeriodView — combined budget amount (unified amount rule)', () => {
  it('a leaf category with no descendants shows just its own budget', () => {
    const categories = [category({ id: 'cat-1', parentCategoryId: null })];
    const budgets = [budget({ id: 'b-1', categoryId: 'cat-1', amount: 500, rolloverAmount: 40 })];
    const row = rowFor(view(categories, budgets, []), 'cat-1');
    expect(row?.amount).toBe(500);
    expect(row?.rolloverAmount).toBe(40);
    expect(row?.implied).toBe(false);
  });

  it("adds a budgeted child's amount/rollover onto the parent's own explicit budget", () => {
    const categories = [
      category({ id: 'housing', parentCategoryId: null }),
      category({ id: 'rent', parentCategoryId: 'housing' }),
    ];
    const budgets = [
      budget({ id: 'b-housing', categoryId: 'housing', amount: 300, rolloverAmount: 10 }),
      budget({ id: 'b-rent', categoryId: 'rent', amount: 1500, rolloverAmount: 50 }),
    ];
    const row = rowFor(view(categories, budgets, []), 'housing');
    expect(row?.amount).toBe(1800);
    expect(row?.rolloverAmount).toBe(60);
    expect(row?.ownAmount).toBe(300);
    expect(row?.implied).toBe(false);
  });

  it('is implied (own amount zero) when only a descendant is budgeted', () => {
    const categories = [
      category({ id: 'transportation', parentCategoryId: null }),
      category({ id: 'auto-payment', parentCategoryId: 'transportation' }),
    ];
    const budgets = [budget({ id: 'b-auto', categoryId: 'auto-payment', amount: 400, rolloverAmount: 0 })];
    const row = rowFor(view(categories, budgets, []), 'transportation');
    expect(row?.amount).toBe(400);
    expect(row?.ownAmount).toBe(0);
    expect(row?.implied).toBe(true);
  });

  it('gets no row at all when nothing in the tree is budgeted and there is no expense activity', () => {
    const categories = [
      category({ id: 'transportation', parentCategoryId: null }),
      category({ id: 'gas', parentCategoryId: 'transportation' }),
    ];
    expect(rowFor(view(categories, [], []), 'transportation')).toBeUndefined();
  });
});

describe('computeBudgetPeriodView — budget status thresholds', () => {
  it('expense: green up to and including 101%', () => {
    expect(statusRow('expense', 410, 500, 40).state).toBe('normal');
    expect(statusRow('expense', 101, 100, 0).state).toBe('normal'); // exactly 101%
  });

  it('expense: amber from just above 101% up to and including 110%', () => {
    expect(statusRow('expense', 105, 100, 0).state).toBe('warning'); // 105%
    expect(statusRow('expense', 110, 100, 0).state).toBe('warning'); // exactly 110%
  });

  it('expense: red above 110%', () => {
    expect(statusRow('expense', 138, 100, 0).state).toBe('over'); // 138%
  });

  describe('rollover adjusts progress, never capacity', () => {
    it('a positive rollover (credit) reduces progress against the unchanged capacity', () => {
      // $100 budget, $60 spent, $50 credit rolled in -> only $10 counts as new progress
      const row = statusRow('expense', 60, 100, 50);
      expect(row.percent).toBeCloseTo(0.1, 5);
      expect(row.state).toBe('normal');
    });

    it('a large positive rollover can push progress negative, reusing the reversed-bar rendering', () => {
      const row = statusRow('expense', 0, 100, 50);
      expect(row.percent).toBeCloseTo(-0.5, 5);
      expect(row.reversed).toBe(true);
      expect(row.barPercent).toBeCloseTo(0.5, 5);
    });

    it('a negative rollover (debt) adds to progress as if already spent, against the unchanged capacity', () => {
      // $100 budget, nothing spent yet, $30 debt carried in -> 30% filled before a dollar spent
      const row = statusRow('expense', 0, 100, -30);
      expect(row.percent).toBeCloseTo(0.3, 5);
      expect(row.state).toBe('normal');
    });

    it('a debt larger than this month\'s budget crosses into "over" through the normal threshold, not a hard override', () => {
      const row = statusRow('expense', 0, 100, -150);
      expect(row.percent).toBeCloseTo(1.5, 5);
      expect(row.state).toBe('over');
    });
  });

  it('income: inverted logic — green at/above target', () => {
    expect(statusRow('income', 4200, 4200, 0).state).toBe('normal');
    expect(statusRow('income', 5000, 4200, 0).state).toBe('normal');
  });

  it('income: amber approaching from below', () => {
    expect(statusRow('income', 3200, 4200, 0).state).toBe('warning'); // ~76%
  });

  it('income: red well under target', () => {
    expect(statusRow('income', 1000, 4200, 0).state).toBe('over'); // ~24%
  });

  it('barPercent clamps to 1 even when percent exceeds it', () => {
    expect(statusRow('expense', 138, 100, 0).barPercent).toBe(1);
  });

  it('positive percent is never reversed', () => {
    expect(statusRow('expense', 50, 100, 0).reversed).toBe(false);
  });

  it('expense: a refund (negative spent) reverses the bar, sized by magnitude, still green', () => {
    const row = statusRow('expense', -20, 100, 0);
    expect(row.percent).toBeCloseTo(-0.2, 5);
    expect(row.reversed).toBe(true);
    expect(row.barPercent).toBeCloseTo(0.2, 5);
    expect(row.state).toBe('normal');
  });

  it('income: a reversal (negative spent) reverses the bar, sized by magnitude, still red', () => {
    const row = statusRow('income', -20, 100, 0);
    expect(row.reversed).toBe(true);
    expect(row.barPercent).toBeCloseTo(0.2, 5);
    expect(row.state).toBe('over');
  });

  it('reversed barPercent caps at 90% (not 100%) for a refund larger than the available amount, and flags reversedCapped', () => {
    const row = statusRow('expense', -150, 100, 0);
    expect(row.reversed).toBe(true);
    expect(row.barPercent).toBe(0.9);
    expect(row.reversedCapped).toBe(true);
  });

  it('a reversed bar at exactly 90% magnitude is not capped — the boundary itself still reads as uncapped', () => {
    const row = statusRow('expense', -90, 100, 0);
    expect(row.barPercent).toBeCloseTo(0.9, 5);
    expect(row.reversedCapped).toBe(false);
  });

  it('a modest reversed bar (well under the cap) is not flagged as capped', () => {
    expect(statusRow('expense', -20, 100, 0).reversedCapped).toBe(false);
  });

  it('reversedCapped is always false when not reversed, regardless of magnitude', () => {
    expect(statusRow('expense', 500, 100, 0).reversedCapped).toBe(false);
  });

  it('a $0-budget expense category with a refund (negative spent, no budget at all) still reverses instead of showing 0%, capped at 90%', () => {
    const row = statusRow('expense', -20, 0, 0);
    expect(row.reversed).toBe(true);
    expect(row.barPercent).toBe(0.9);
    expect(row.reversedCapped).toBe(true);
    expect(row.state).toBe('normal');
  });

  it('a $0-budget income category with a reversal (negative spent, no budget at all) still reverses instead of showing 0%, capped at 90%', () => {
    const row = statusRow('income', -20, 0, 0);
    expect(row.reversed).toBe(true);
    expect(row.barPercent).toBe(0.9);
    expect(row.reversedCapped).toBe(true);
    expect(row.state).toBe('over');
  });
});

describe('computeBudgetPeriodView — flow-progress uncategorized totals', () => {
  it('sums a positive-amount uncategorized transaction as income', () => {
    const transactions = [txn({ categoryId: null, amount: 200, date: '2026-08-05' })];
    const v = view([], [], transactions);
    expect(v.flowProgress.income.uncategorizedActual).toBe(200);
    expect(v.flowProgress.expenses.uncategorizedActual).toBe(0);
  });

  it('sums a negative-amount uncategorized transaction as a positive expense', () => {
    const transactions = [txn({ categoryId: null, amount: -75, date: '2026-08-05' })];
    const v = view([], [], transactions);
    expect(v.flowProgress.expenses.uncategorizedActual).toBe(75);
    expect(v.flowProgress.income.uncategorizedActual).toBe(0);
  });

  it('excludes a categorized transaction from the uncategorized totals', () => {
    const categories = [category({ id: 'cat-1', type: 'expense' })];
    const transactions = [txn({ categoryId: 'cat-1', amount: -75, date: '2026-08-05' })];
    expect(view(categories, [], transactions).flowProgress.expenses.uncategorizedActual).toBe(0);
  });

  it('excludes an uncategorized transaction flagged excludeFromBudget', () => {
    const transactions = [txn({ categoryId: null, amount: -75, date: '2026-08-05', excludeFromBudget: true })];
    expect(view([], [], transactions).flowProgress.expenses.uncategorizedActual).toBe(0);
  });

  it('excludes a transaction outside the given period', () => {
    const transactions = [txn({ categoryId: null, amount: -75, date: '2026-07-05' })];
    expect(view([], [], transactions, '2026-08').flowProgress.expenses.uncategorizedActual).toBe(0);
  });

  it('sums multiple uncategorized transactions of both signs', () => {
    const transactions = [
      txn({ id: 't1', categoryId: null, amount: 500, date: '2026-08-01' }),
      txn({ id: 't2', categoryId: null, amount: -30, date: '2026-08-10' }),
      txn({ id: 't3', categoryId: null, amount: -20, date: '2026-08-11' }),
    ];
    const v = view([], [], transactions);
    expect(v.flowProgress.income.uncategorizedActual).toBe(500);
    expect(v.flowProgress.expenses.uncategorizedActual).toBe(50);
  });
});

describe('computeBudgetPeriodView — flow-progress row composition', () => {
  it('combines categorized and uncategorized actuals into totalActual', () => {
    const categories = [category({ id: 'cat-1', type: 'expense' })];
    const budgets = [budget({ id: 'b-1', categoryId: 'cat-1', amount: 500 })];
    const transactions = [
      txn({ id: 't1', categoryId: 'cat-1', amount: -300, date: '2026-08-05' }),
      txn({ id: 't2', categoryId: null, amount: -50, date: '2026-08-06' }),
    ];
    const row = view(categories, budgets, transactions).flowProgress.expenses;
    expect(row.totalActual).toBe(350);
    expect(row.barPercent).toBeCloseTo(0.7, 5);
  });

  it('income is always the "info" state regardless of percent', () => {
    const categories = [category({ id: 'cat-1', type: 'income' })];
    const budgets = [budget({ id: 'b-1', categoryId: 'cat-1', amount: 4000 })];
    const under = view(categories, budgets, [txn({ categoryId: 'cat-1', amount: 100, date: '2026-08-05' })]);
    const over = view(categories, budgets, [txn({ categoryId: 'cat-1', amount: 5000, date: '2026-08-05' })]);
    expect(under.flowProgress.income.state).toBe('info');
    expect(over.flowProgress.income.state).toBe('info');
  });

  it('expenses use the normal/warning/over three-state against the combined actual', () => {
    const categories = [category({ id: 'cat-1', type: 'expense' })];
    const budgets = [budget({ id: 'b-1', categoryId: 'cat-1', amount: 500 })];
    const categorized = txn({ id: 't1', categoryId: 'cat-1', amount: -400, date: '2026-08-05' });

    const normal = view(categories, budgets, [categorized]);
    expect(normal.flowProgress.expenses.state).toBe('normal'); // 80%

    const warning = view(categories, budgets, [
      categorized,
      txn({ id: 't2', categoryId: null, amount: -120, date: '2026-08-06' }),
    ]);
    expect(warning.flowProgress.expenses.state).toBe('warning'); // 104%

    const over = view(categories, budgets, [
      categorized,
      txn({ id: 't2', categoryId: null, amount: -200, date: '2026-08-06' }),
    ]);
    expect(over.flowProgress.expenses.state).toBe('over'); // 120%
  });

  it('a zero budget target forces a full-width bar, and any spend reads "over" (issue #21\'s $0-budget convention)', () => {
    const categories = [category({ id: 'cat-1', type: 'expense' })];
    const transactions = [txn({ categoryId: 'cat-1', amount: -40, date: '2026-08-05' })];
    const row = view(categories, [], transactions).flowProgress.expenses;
    expect(row.zeroBudget).toBe(true);
    expect(row.barPercent).toBe(1);
    expect(row.state).toBe('over');
  });

  it('with nothing budgeted or spent, expenses read "normal" and income stays "info"', () => {
    const v = view([], [], []);
    expect(v.flowProgress.expenses.state).toBe('normal');
    expect(v.flowProgress.income.state).toBe('info');
  });

  it('a non-zero budget clamps barPercent to 1 even over 100%', () => {
    const categories = [category({ id: 'cat-1', type: 'expense' })];
    const budgets = [budget({ id: 'b-1', categoryId: 'cat-1', amount: 500 })];
    const transactions = [txn({ categoryId: 'cat-1', amount: -600, date: '2026-08-05' })];
    const row = view(categories, budgets, transactions).flowProgress.expenses;
    expect(row.zeroBudget).toBe(false);
    expect(row.barPercent).toBe(1);
  });

  it('threads reversed through for a negative combined actual (expense)', () => {
    const categories = [category({ id: 'cat-1', type: 'expense' })];
    const budgets = [budget({ id: 'b-1', categoryId: 'cat-1', amount: 100 })];
    const transactions = [txn({ categoryId: 'cat-1', amount: 30, date: '2026-08-05' })]; // refund exceeds spend
    const row = view(categories, budgets, transactions).flowProgress.expenses;
    expect(row.reversed).toBe(true);
    expect(row.barPercent).toBeCloseTo(0.3, 5);
  });

  it('threads reversed through for income too, even though color stays info', () => {
    const categories = [category({ id: 'cat-1', type: 'income' })];
    const budgets = [budget({ id: 'b-1', categoryId: 'cat-1', amount: 100 })];
    const transactions = [txn({ categoryId: 'cat-1', amount: -30, date: '2026-08-05' })]; // a reversal
    const row = view(categories, budgets, transactions).flowProgress.income;
    expect(row.reversed).toBe(true);
    expect(row.state).toBe('info');
  });

  it('a zero-budget row with a negative total still reverses instead of rendering a full forward bar, keeping the reversed cap', () => {
    const categories = [category({ id: 'cat-1', type: 'expense' })];
    const transactions = [txn({ categoryId: 'cat-1', amount: 20, date: '2026-08-05' })]; // refund, no budget at all
    const row = view(categories, [], transactions).flowProgress.expenses;
    expect(row.zeroBudget).toBe(true);
    expect(row.reversed).toBe(true);
    expect(row.reversedCapped).toBe(true);
    expect(row.barPercent).toBe(0.9);
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
    const budgets = [budget({ id: 'b-jul', period: '2026-07', amount: 500, rollOver: true, rolloverAmount: 0 })];
    const transactions = [txn({ categoryId: 'cat-1', amount: -300, date: '2026-07-10' })];

    const result = recomputeRollovers(budgets, transactions, categories, '2026-08');

    expect(result.createdBudgets).toHaveLength(1);
    const augustBudget = result.createdBudgets[0];
    expect(augustBudget.period).toBe('2026-08');
    expect(augustBudget.rolloverAmount).toBe(200); // 500 - 300
  });

  it('compounds rollover across multiple skipped months in one call', () => {
    const categories = [category({ id: 'cat-1' })];
    const budgets = [budget({ id: 'b-jun', period: '2026-06', amount: 500, rollOver: true, rolloverAmount: 0 })];
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
    const budgets = [budget({ id: 'b-jul', categoryId: 'paycheck', period: '2026-07', amount: 4000, rollOver: true })];
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

  it('carries a negative rollover forward when overspent, with no floor at zero', () => {
    const categories = [category({ id: 'cat-1' })];
    const budgets = [budget({ id: 'b-jul', period: '2026-07', amount: 500, rollOver: true, rolloverAmount: 0 })];
    const transactions = [txn({ categoryId: 'cat-1', amount: -650, date: '2026-07-10' })];

    const result = recomputeRollovers(budgets, transactions, categories, '2026-08');

    expect(result.createdBudgets).toHaveLength(1);
    expect(result.createdBudgets[0].rolloverAmount).toBe(-150); // 500 - 650
  });

  it('compounds a growing deficit across multiple overspent months', () => {
    const categories = [category({ id: 'cat-1' })];
    const budgets = [budget({ id: 'b-jun', period: '2026-06', amount: 200, rollOver: true, rolloverAmount: 0 })];
    const transactions = [
      txn({ id: 't-jun', categoryId: 'cat-1', amount: -300, date: '2026-06-10' }), // -> Jul rollover: -100
      txn({ id: 't-jul', categoryId: 'cat-1', amount: -150, date: '2026-07-10' }), // available Jul = 100, actual 150 -> Aug: -50
    ];

    const result = recomputeRollovers(budgets, transactions, categories, '2026-08');

    const julyBudget = result.budgets.find((b) => b.period === '2026-07');
    const augustBudget = result.budgets.find((b) => b.period === '2026-08');
    expect(julyBudget?.rolloverAmount).toBe(-100);
    expect(augustBudget?.rolloverAmount).toBe(-50);
  });

  it('never recomputes a period whose rolloverAmount was manually set', () => {
    const categories = [category({ id: 'cat-1' })];
    const budgets = [
      budget({ id: 'b-jul', period: '2026-07', amount: 500, rollOver: true, rolloverAmount: 0 }),
      budget({
        id: 'b-aug',
        period: '2026-08',
        amount: 500,
        rollOver: true,
        rolloverAmount: 999,
        rolloverManual: true,
      }),
    ];
    const transactions = [txn({ categoryId: 'cat-1', amount: -300, date: '2026-07-10' })]; // would auto-compute to 200

    const result = recomputeRollovers(budgets, transactions, categories, '2026-08');

    expect(result.changedBudgetIds.has('b-aug')).toBe(false);
    expect(result.budgets.find((b) => b.id === 'b-aug')?.rolloverAmount).toBe(999);
  });

  it('still carries a manual override forward as the base for the next period', () => {
    const categories = [category({ id: 'cat-1' })];
    const budgets = [
      budget({
        id: 'b-jul',
        period: '2026-07',
        amount: 500,
        rollOver: true,
        rolloverAmount: 300,
        rolloverManual: true,
      }),
    ];
    const transactions = [txn({ categoryId: 'cat-1', amount: -100, date: '2026-07-10' })];

    const result = recomputeRollovers(budgets, transactions, categories, '2026-08');

    // August is computed fresh from July's manual override: (500 + 300) - 100 = 700
    const augustBudget = result.createdBudgets.find((b) => b.period === '2026-08');
    expect(augustBudget?.rolloverAmount).toBe(700);
  });

  it('is idempotent when run twice with the same inputs', () => {
    const categories = [category({ id: 'cat-1' })];
    const budgets = [budget({ id: 'b-jul', period: '2026-07', amount: 500, rollOver: true, rolloverAmount: 0 })];
    const transactions = [txn({ categoryId: 'cat-1', amount: -300, date: '2026-07-10' })];

    const first = recomputeRollovers(budgets, transactions, categories, '2026-08');
    const second = recomputeRollovers(first.budgets, transactions, categories, '2026-08');

    expect(second.createdBudgets).toHaveLength(0);
    expect(second.changedBudgetIds.size).toBe(0);
  });
});
