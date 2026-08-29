import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountMigrationStrategies, accountSchema, budgetSchema, categorySchema, transactionSchema } from '../data/schemas';
import { DatabaseService } from '../data/database.service';
import type { Account, Budget, Category, Transaction } from '../data/models';
import { SimplefinSyncService } from '../simplefin/simplefin-sync.service';
import { TransactionMutationService } from '../transactions/transaction-mutation.service';
import { currentYearMonth, formatYearMonth, previousYearMonth } from './period.util';
import { BudgetsStore } from './budgets.store';

function seedCategory(overrides: Partial<Category> = {}): Category {
  return { id: 'cat-1', name: 'Groceries', parentCategoryId: null, type: 'expense', ...overrides };
}

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

function seedBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-1',
    categoryId: 'cat-1',
    periodType: 'month',
    period: currentYearMonth(),
    rollOver: false,
    rolloverAmount: 0,
    amount: 500,
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
    categoryId: 'cat-1',
    excludeFromBudget: false,
    notes: null,
    ...overrides,
  };
}

describe('BudgetsStore', () => {
  let fakeDb: RxDatabase;
  let store: BudgetsStore;
  let mutationService: {
    assignCategory: ReturnType<typeof vi.fn>;
    setNotes: ReturnType<typeof vi.fn>;
    setExcludeFromBudget: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    fakeDb = await createRxDatabase({
      name: `budgets-store-test-${Math.random().toString(36).slice(2)}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
    });
    await fakeDb.addCollections({
      budgets: { schema: budgetSchema },
      categories: { schema: categorySchema },
      transactions: { schema: transactionSchema },
      accounts: { schema: accountSchema, migrationStrategies: accountMigrationStrategies },
    });

    mutationService = {
      assignCategory: vi.fn(async () => {}),
      setNotes: vi.fn(async () => {}),
      setExcludeFromBudget: vi.fn(async () => {}),
    };

    TestBed.configureTestingModule({
      providers: [
        BudgetsStore,
        { provide: DatabaseService, useValue: { getDatabase: () => Promise.resolve(fakeDb) } },
        { provide: SimplefinSyncService, useValue: { syncing: () => false } },
        { provide: TransactionMutationService, useValue: mutationService },
      ],
    });
    store = TestBed.inject(BudgetsStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
  });

  afterEach(async () => {
    await fakeDb.remove();
  });

  it('starts empty when there are no budgets', () => {
    expect(store.rows()).toEqual([]);
  });

  it('builds a row with rollup spend and status for a budgeted category', async () => {
    await fakeDb['categories'].insert(seedCategory());
    await fakeDb['budgets'].insert(seedBudget({ amount: 100, rollOver: false }));
    await fakeDb['transactions'].insert(seedTransaction({ amount: -85 }));

    await store.refresh();

    expect(store.rows()).toHaveLength(1);
    const row = store.rows()[0];
    expect(row.categoryName).toBe('Groceries');
    expect(row.spent).toBe(85);
    expect(row.state).toBe('normal'); // 85%, below the 101% green ceiling
  });

  it('carries a row\'s parentCategoryId from its category, null for top-level categories', async () => {
    await fakeDb['categories'].bulkInsert([
      seedCategory({ id: 'housing', name: 'Housing' }),
      seedCategory({ id: 'rent', name: 'Rent', parentCategoryId: 'housing' }),
    ]);
    await fakeDb['budgets'].bulkInsert([
      seedBudget({ id: 'b-housing', categoryId: 'housing', amount: 2000 }),
      seedBudget({ id: 'b-rent', categoryId: 'rent', amount: 1500 }),
    ]);

    await store.refresh();

    const housingRow = store.rows().find((r) => r.categoryId === 'housing');
    const rentRow = store.rows().find((r) => r.categoryId === 'rent');
    expect(housingRow?.parentCategoryId).toBeNull();
    expect(rentRow?.parentCategoryId).toBe('housing');
  });

  it('exposes the transactions it loaded for the current period', async () => {
    await fakeDb['categories'].insert(seedCategory());
    await fakeDb['transactions'].insert(seedTransaction());

    await store.refresh();

    expect(store.transactions().map((t) => t.id)).toEqual(['txn-1']);
  });

  it('accountName resolves a known account and falls back to an empty string', async () => {
    await fakeDb['accounts'].insert(seedAccount({ name: 'Checking' }));

    await store.refresh();

    expect(store.accountName('acc-1')).toBe('Checking');
    expect(store.accountName('missing')).toBe('');
  });

  it('assignCategory delegates to TransactionMutationService and refreshes', async () => {
    await store.assignCategory('txn-1', 'cat-1');

    expect(mutationService.assignCategory).toHaveBeenCalledWith('txn-1', 'cat-1');
  });

  it('setNotes delegates to TransactionMutationService and refreshes', async () => {
    await store.setNotes('txn-1', 'Reimbursed by roommate');

    expect(mutationService.setNotes).toHaveBeenCalledWith('txn-1', 'Reimbursed by roommate');
  });

  it('setExcludeFromBudget delegates to TransactionMutationService and refreshes', async () => {
    await store.setExcludeFromBudget('txn-1', true);

    expect(mutationService.setExcludeFromBudget).toHaveBeenCalledWith('txn-1', true);
  });

  it('rolls an unbudgeted child\'s spend up into a budgeted parent row, and also gives the child its own $0 computed row (issue #21)', async () => {
    await fakeDb['categories'].bulkInsert([
      seedCategory({ id: 'housing', name: 'Housing' }),
      seedCategory({ id: 'rent', name: 'Rent', parentCategoryId: 'housing' }),
    ]);
    await fakeDb['budgets'].insert(seedBudget({ id: 'b-housing', categoryId: 'housing', amount: 2000 }));
    await fakeDb['transactions'].insert(seedTransaction({ categoryId: 'rent', amount: -1500 }));

    await store.refresh();

    expect(store.rows()).toHaveLength(2);
    const housingRow = store.rows().find((r) => r.categoryId === 'housing');
    expect(housingRow?.spent).toBe(1500);
    const rentRow = store.rows().find((r) => r.categoryId === 'rent');
    expect(rentRow?.implied).toBe(true);
    expect(rentRow?.amount).toBe(0);
    expect(rentRow?.spent).toBe(1500);
  });

  it('categoriesWithoutCurrentBudget excludes already-budgeted categories', async () => {
    await fakeDb['categories'].bulkInsert([seedCategory({ id: 'cat-1' }), seedCategory({ id: 'cat-2', name: 'Dining' })]);
    await fakeDb['budgets'].insert(seedBudget({ categoryId: 'cat-1' }));

    await store.refresh();

    const available = store.categoriesWithoutCurrentBudget();
    expect(available.map((c) => c.id)).toEqual(['cat-2']);
  });

  it('addBudget creates a budget and refreshes rows', async () => {
    await fakeDb['categories'].insert(seedCategory());

    await store.addBudget('cat-1', 300, true);

    expect(store.rows()).toHaveLength(1);
    expect(store.rows()[0].amount).toBe(300);
  });

  it('addBudget surfaces a validation error without throwing', async () => {
    await store.addBudget('missing-category', 300, false);

    expect(store.error()).toBe('Category not found.');
    expect(store.rows()).toHaveLength(0);
  });

  it('updateBudget patches an existing budget and refreshes', async () => {
    await fakeDb['categories'].insert(seedCategory());
    await fakeDb['budgets'].insert(seedBudget({ amount: 100 }));
    await store.refresh();
    const id = store.rows()[0].id;

    await store.updateBudget(id, 250, false);

    expect(store.rows()[0].amount).toBe(250);
  });

  it('deleteBudget removes a budget and refreshes', async () => {
    await fakeDb['categories'].insert(seedCategory());
    await fakeDb['budgets'].insert(seedBudget());
    await store.refresh();
    const id = store.rows()[0].id;

    await store.deleteBudget(id);

    expect(store.rows()).toHaveLength(0);
  });

  describe('implied parent budgets (issue #15)', () => {
    it('synthesizes a row for a parent with no explicit budget but a budgeted child', async () => {
      await fakeDb['categories'].bulkInsert([
        seedCategory({ id: 'transportation', name: 'Transportation' }),
        seedCategory({ id: 'auto-payment', name: 'Auto Payment', parentCategoryId: 'transportation' }),
      ]);
      await fakeDb['budgets'].insert(
        seedBudget({ id: 'b-auto', categoryId: 'auto-payment', amount: 400, rolloverAmount: 0 }),
      );
      await fakeDb['transactions'].insert(
        seedTransaction({ categoryId: 'auto-payment', amount: -350 }),
      );

      await store.refresh();

      expect(store.rows()).toHaveLength(2);
      const impliedRow = store.rows().find((r) => r.categoryId === 'transportation');
      expect(impliedRow?.implied).toBe(true);
      expect(impliedRow?.id).not.toBe('b-auto');
      expect(impliedRow?.amount).toBe(400);
      expect(impliedRow?.spent).toBe(350);
      expect(impliedRow?.parentCategoryId).toBeNull();

      const childRow = store.rows().find((r) => r.categoryId === 'auto-payment');
      expect(childRow?.implied).toBe(false);
      expect(childRow?.id).toBe('b-auto');
    });

    it('combines a parent\'s own budget/spend with a budgeted child\'s, instead of excluding it', async () => {
      await fakeDb['categories'].bulkInsert([
        seedCategory({ id: 'housing', name: 'Housing' }),
        seedCategory({ id: 'rent', name: 'Rent', parentCategoryId: 'housing' }),
      ]);
      await fakeDb['budgets'].bulkInsert([
        seedBudget({ id: 'b-housing', categoryId: 'housing', amount: 300 }),
        seedBudget({ id: 'b-rent', categoryId: 'rent', amount: 1500 }),
      ]);
      await fakeDb['transactions'].bulkInsert([
        seedTransaction({ id: 't-housing', categoryId: 'housing', amount: -20 }),
        seedTransaction({ id: 't-rent', categoryId: 'rent', amount: -1500 }),
      ]);

      await store.refresh();

      const housingRow = store.rows().find((r) => r.categoryId === 'housing');
      expect(housingRow?.implied).toBe(false);
      expect(housingRow?.amount).toBe(1800);
      expect(housingRow?.spent).toBe(1520);
      // ownAmount stays Housing's own 300 — edit prefill must never use the combined 1800,
      // or saving unchanged would silently inflate it by Rent's amount on every edit.
      expect(housingRow?.ownAmount).toBe(300);
    });

    it('does not generate any row for an unbudgeted category tree', async () => {
      await fakeDb['categories'].bulkInsert([
        seedCategory({ id: 'misc', name: 'Misc' }),
        seedCategory({ id: 'misc-child', name: 'Misc child', parentCategoryId: 'misc' }),
      ]);

      await store.refresh();

      expect(store.rows()).toHaveLength(0);
    });

    it('categoriesWithoutCurrentBudget keeps an implied-only category selectable', async () => {
      await fakeDb['categories'].bulkInsert([
        seedCategory({ id: 'transportation', name: 'Transportation' }),
        seedCategory({ id: 'auto-payment', name: 'Auto Payment', parentCategoryId: 'transportation' }),
      ]);
      await fakeDb['budgets'].insert(seedBudget({ id: 'b-auto', categoryId: 'auto-payment', amount: 400 }));

      await store.refresh();

      expect(store.categoriesWithoutCurrentBudget().map((c) => c.id)).toEqual(['transportation']);
    });

    it('transactionsForCategoryTree spans a category and all of its descendants', async () => {
      await fakeDb['categories'].bulkInsert([
        seedCategory({ id: 'housing', name: 'Housing' }),
        seedCategory({ id: 'rent', name: 'Rent', parentCategoryId: 'housing' }),
      ]);
      await fakeDb['transactions'].bulkInsert([
        seedTransaction({ id: 't-housing', categoryId: 'housing', amount: -20 }),
        seedTransaction({ id: 't-rent', categoryId: 'rent', amount: -1500 }),
      ]);

      await store.refresh();

      expect(store.transactionsForCategoryTree('housing').map((t) => t.id).sort()).toEqual(['t-housing', 't-rent']);
    });
  });

  describe('aggregate', () => {
    it('sums expense budgets only, excluding income from the spent-of-budgeted total', async () => {
      await fakeDb['categories'].bulkInsert([
        seedCategory({ id: 'cat-1', name: 'Groceries', type: 'expense' }),
        seedCategory({ id: 'paycheck', name: 'Paycheck', type: 'income' }),
      ]);
      await fakeDb['budgets'].bulkInsert([
        seedBudget({ id: 'b-1', categoryId: 'cat-1', amount: 500 }),
        seedBudget({ id: 'b-2', categoryId: 'paycheck', amount: 4000 }),
      ]);
      await fakeDb['transactions'].bulkInsert([
        seedTransaction({ id: 't-1', categoryId: 'cat-1', amount: -300 }),
        seedTransaction({ id: 't-2', categoryId: 'paycheck', amount: 3800 }),
      ]);

      await store.refresh();

      const aggregate = store.aggregate();
      expect(aggregate.totalBudget).toBe(500);
      expect(aggregate.totalSpent).toBe(300);
      expect(aggregate.remaining).toBe(200);
      expect(aggregate.earned).toBe(3800);
      expect(aggregate.cashFlowNet).toBe(3500);
    });

    it('scopes the overall total to top-level rows, not double-counting a budgeted child\'s own row', async () => {
      await fakeDb['categories'].bulkInsert([
        seedCategory({ id: 'housing', name: 'Housing', type: 'expense' }),
        seedCategory({ id: 'rent', name: 'Rent', parentCategoryId: 'housing', type: 'expense' }),
      ]);
      await fakeDb['budgets'].bulkInsert([
        seedBudget({ id: 'b-housing', categoryId: 'housing', amount: 300 }),
        seedBudget({ id: 'b-rent', categoryId: 'rent', amount: 1500 }),
      ]);
      await fakeDb['transactions'].insert(seedTransaction({ categoryId: 'rent', amount: -1500 }));

      await store.refresh();

      // Housing's row already combines Rent's 1500/1500 into its own 300/0 — the aggregate must
      // count that combined total once, not once via Housing's row and again via Rent's own row.
      const aggregate = store.aggregate();
      expect(aggregate.totalBudget).toBe(1800);
      expect(aggregate.totalSpent).toBe(1500);
    });

    it('counts an entirely unbudgeted income category toward earned (issue #21 cash-flow box)', async () => {
      // No budget anywhere for this category, so it never gets a row (bullet 3's $0-computed
      // rule is expense-only) — earned must still be sourced from actuals directly, not from
      // rows, or the cash-flow box's "unbudgeted actual income" overage could never render.
      await fakeDb['categories'].insert(seedCategory({ id: 'interest', name: 'Interest Income', type: 'income' }));
      await fakeDb['transactions'].insert(seedTransaction({ categoryId: 'interest', amount: 50 }));

      await store.refresh();

      expect(store.rows()).toHaveLength(0);
      expect(store.aggregate().earned).toBe(50);
    });
  });

  describe('$0 computed budgets for unbudgeted spend (issue #21)', () => {
    it('synthesizes a $0 implied row for a category with expenses but no budget anywhere in its tree', async () => {
      await fakeDb['categories'].insert(seedCategory({ id: 'dining', name: 'Dining' }));
      await fakeDb['transactions'].insert(seedTransaction({ categoryId: 'dining', amount: -40 }));

      await store.refresh();

      expect(store.rows()).toHaveLength(1);
      const diningRow = store.rows()[0];
      expect(diningRow.implied).toBe(true);
      expect(diningRow.amount).toBe(0);
      expect(diningRow.spent).toBe(40);
      expect(diningRow.percent).toBe(1);
      expect(diningRow.state).toBe('over');
    });

    it('synthesizes a $0 implied row for a parent whose only spend comes from an unbudgeted child', async () => {
      await fakeDb['categories'].bulkInsert([
        seedCategory({ id: 'misc', name: 'Misc' }),
        seedCategory({ id: 'misc-child', name: 'Misc child', parentCategoryId: 'misc' }),
      ]);
      await fakeDb['transactions'].insert(seedTransaction({ categoryId: 'misc-child', amount: -15 }));

      await store.refresh();

      expect(store.rows()).toHaveLength(2);
      const parentRow = store.rows().find((r) => r.categoryId === 'misc');
      expect(parentRow?.implied).toBe(true);
      expect(parentRow?.spent).toBe(15);
    });

    it('does not synthesize a row for an income category with no budget, even if it has activity', async () => {
      await fakeDb['categories'].insert(seedCategory({ id: 'paycheck', name: 'Paycheck', type: 'income' }));
      await fakeDb['transactions'].insert(seedTransaction({ categoryId: 'paycheck', amount: 500 }));

      await store.refresh();

      expect(store.rows()).toHaveLength(0);
    });
  });

  describe('parent-above-child ordering (issue #21)', () => {
    it('places a parent row immediately above its children, even when the parent sorts alphabetically after them', async () => {
      await fakeDb['categories'].bulkInsert([
        seedCategory({ id: 'zzz-parent', name: 'Zzz Parent' }),
        seedCategory({ id: 'aaa-child', name: 'Aaa Child', parentCategoryId: 'zzz-parent' }),
        seedCategory({ id: 'aaa-other', name: 'Aaa Other' }),
      ]);
      await fakeDb['budgets'].bulkInsert([
        seedBudget({ id: 'b-parent', categoryId: 'zzz-parent', amount: 100 }),
        seedBudget({ id: 'b-child', categoryId: 'aaa-child', amount: 50 }),
        seedBudget({ id: 'b-other', categoryId: 'aaa-other', amount: 20 }),
      ]);

      await store.refresh();

      expect(store.rows().map((r) => r.categoryId)).toEqual(['aaa-other', 'zzz-parent', 'aaa-child']);
    });
  });

  describe('month navigation (issue #23)', () => {
    it('starts on the current month, unable to go forward', () => {
      expect(store.aggregate().monthName).toBe(formatYearMonth(currentYearMonth()));
      expect(store.isCurrentPeriod()).toBe(true);
      expect(store.canGoToNextMonth()).toBe(false);
    });

    it('cannot go back with no transactions at all', () => {
      expect(store.canGoToPreviousMonth()).toBe(false);
      store.goToPreviousMonth();
      expect(store.aggregate().monthName).toBe(formatYearMonth(currentYearMonth()));
    });

    it('goToPreviousMonth switches rows/aggregate to the prior month\'s budgets and spend', async () => {
      const prevPeriod = previousYearMonth(currentYearMonth());
      await fakeDb['categories'].insert(seedCategory());
      await fakeDb['budgets'].insert(seedBudget({ period: prevPeriod, amount: 200 }));
      await fakeDb['transactions'].insert(seedTransaction({ date: `${prevPeriod}-05`, amount: -50 }));
      await store.refresh();
      // The prior month's budget carries forward as effective for the current month too
      // (getEffectiveBudgetForScope), but that month had no spend of its own.
      expect(store.rows()).toHaveLength(1);
      expect(store.rows()[0].spent).toBe(0);

      store.goToPreviousMonth();

      expect(store.isCurrentPeriod()).toBe(false);
      expect(store.aggregate().monthName).toBe(formatYearMonth(prevPeriod));
      expect(store.rows()).toHaveLength(1);
      expect(store.rows()[0].amount).toBe(200);
      expect(store.rows()[0].spent).toBe(50);
    });

    it('stops at the earliest transaction\'s month and refuses to go further back', async () => {
      const prevPeriod = previousYearMonth(currentYearMonth());
      await fakeDb['transactions'].insert(seedTransaction({ date: `${prevPeriod}-05` }));
      await store.refresh();

      expect(store.canGoToPreviousMonth()).toBe(true);
      store.goToPreviousMonth();
      expect(store.canGoToPreviousMonth()).toBe(false);

      store.goToPreviousMonth();
      expect(store.aggregate().monthName).toBe(formatYearMonth(prevPeriod));
    });

    it('goToNextMonth moves forward but refuses to pass the current month', async () => {
      const prevPeriod = previousYearMonth(currentYearMonth());
      await fakeDb['transactions'].insert(seedTransaction({ date: `${prevPeriod}-05` }));
      await store.refresh();
      store.goToPreviousMonth();

      expect(store.canGoToNextMonth()).toBe(true);
      store.goToNextMonth();
      expect(store.aggregate().monthName).toBe(formatYearMonth(currentYearMonth()));
      expect(store.isCurrentPeriod()).toBe(true);

      store.goToNextMonth();
      expect(store.aggregate().monthName).toBe(formatYearMonth(currentYearMonth()));
    });

    it('monthPhrase reads "this month" for the current period and names the viewed month otherwise', () => {
      expect(store.monthPhrase()).toBe('this month');

      store.goToPreviousMonth(); // no-op with no transactions, still current
      expect(store.monthPhrase()).toBe('this month');
    });

    it('monthPhrase names the viewed month once browsing a past period', async () => {
      const prevPeriod = previousYearMonth(currentYearMonth());
      await fakeDb['transactions'].insert(seedTransaction({ date: `${prevPeriod}-05` }));
      await store.refresh();

      store.goToPreviousMonth();

      expect(store.monthPhrase()).toBe(`in ${formatYearMonth(prevPeriod)}`);
    });

    it('linkQueryParams is undefined for the current period and carries the period once browsing the past', async () => {
      const prevPeriod = previousYearMonth(currentYearMonth());
      await fakeDb['transactions'].insert(seedTransaction({ date: `${prevPeriod}-05` }));
      await store.refresh();
      expect(store.linkQueryParams()).toBeUndefined();

      store.goToPreviousMonth();

      expect(store.linkQueryParams()).toEqual({ period: prevPeriod });
    });

    it('aggregate message names the viewed month instead of always saying "this month"', async () => {
      const prevPeriod = previousYearMonth(currentYearMonth());
      await fakeDb['categories'].insert(seedCategory());
      await fakeDb['budgets'].insert(seedBudget({ period: prevPeriod, amount: 100 }));
      await fakeDb['transactions'].insert(seedTransaction({ date: `${prevPeriod}-05`, amount: -150 }));
      await store.refresh();
      expect(store.aggregate().message).toContain('this month');

      store.goToPreviousMonth();

      expect(store.aggregate().message).toContain(`in ${formatYearMonth(prevPeriod)}`);
      expect(store.aggregate().message).not.toContain('this month');
    });

    it('transactionsForCategoryTree reflects the viewed period, not always the current month', async () => {
      const prevPeriod = previousYearMonth(currentYearMonth());
      await fakeDb['categories'].insert(seedCategory({ id: 'housing', name: 'Housing' }));
      await fakeDb['transactions'].insert(
        seedTransaction({ id: 't-prev', categoryId: 'housing', date: `${prevPeriod}-05` }),
      );
      await store.refresh();
      expect(store.transactionsForCategoryTree('housing')).toHaveLength(0);

      store.goToPreviousMonth();

      expect(store.transactionsForCategoryTree('housing').map((t) => t.id)).toEqual(['t-prev']);
    });
  });

  describe('flowProgress (issue #42)', () => {
    it('includes uncategorized transactions in both totals via the sign heuristic', async () => {
      await fakeDb['categories'].bulkInsert([
        seedCategory({ id: 'groceries', name: 'Groceries', type: 'expense' }),
        seedCategory({ id: 'paycheck', name: 'Paycheck', type: 'income' }),
      ]);
      await fakeDb['budgets'].bulkInsert([
        seedBudget({ id: 'b-groceries', categoryId: 'groceries', amount: 500 }),
        seedBudget({ id: 'b-paycheck', categoryId: 'paycheck', amount: 4000 }),
      ]);
      await fakeDb['transactions'].bulkInsert([
        seedTransaction({ id: 't-groceries', categoryId: 'groceries', amount: -300 }),
        seedTransaction({ id: 't-paycheck', categoryId: 'paycheck', amount: 3800 }),
        seedTransaction({ id: 't-uncategorized-expense', categoryId: null, amount: -40 }),
        seedTransaction({ id: 't-uncategorized-income', categoryId: null, amount: 100 }),
      ]);

      await store.refresh();

      const progress = store.flowProgress();
      expect(progress.expenses.categorizedActual).toBe(300);
      expect(progress.expenses.uncategorizedActual).toBe(40);
      expect(progress.expenses.totalActual).toBe(340);
      expect(progress.income.categorizedActual).toBe(3800);
      expect(progress.income.uncategorizedActual).toBe(100);
      expect(progress.income.totalActual).toBe(3900);
    });

    it('income is always the "info" (blue) state, unaffected by percent', async () => {
      await fakeDb['categories'].insert(seedCategory({ id: 'paycheck', name: 'Paycheck', type: 'income' }));
      await fakeDb['budgets'].insert(seedBudget({ categoryId: 'paycheck', amount: 4000 }));
      await fakeDb['transactions'].insert(seedTransaction({ categoryId: 'paycheck', amount: 100 }));

      await store.refresh();

      expect(store.flowProgress().income.state).toBe('info');
    });

    it('excludes an excludeFromBudget-flagged uncategorized transaction', async () => {
      await fakeDb['transactions'].insert(
        seedTransaction({ categoryId: null, amount: -500, excludeFromBudget: true }),
      );

      await store.refresh();

      expect(store.flowProgress().expenses.uncategorizedActual).toBe(0);
    });

    it('a zero budget target renders a full-width bar', async () => {
      await fakeDb['categories'].insert(seedCategory({ id: 'dining', name: 'Dining' }));
      await fakeDb['transactions'].insert(seedTransaction({ categoryId: 'dining', amount: -40 }));

      await store.refresh();

      // Dining has no explicit budget anywhere, so totalBudget/budgetedIncome are both 0.
      expect(store.flowProgress().expenses.zeroBudget).toBe(true);
      expect(store.flowProgress().expenses.barPercent).toBe(1);
      expect(store.flowProgress().income.zeroBudget).toBe(true);
      expect(store.flowProgress().income.barPercent).toBe(1);
    });
  });

  describe('incomeSectionRows (issue #42)', () => {
    it('hides a sole implied top-level Income row when there is exactly one top-level income category', async () => {
      await fakeDb['categories'].bulkInsert([
        seedCategory({ id: 'income', name: 'Income', type: 'income' }),
        seedCategory({ id: 'salary', name: 'Salary', parentCategoryId: 'income', type: 'income' }),
      ]);
      await fakeDb['budgets'].insert(seedBudget({ id: 'b-salary', categoryId: 'salary', amount: 4000 }));
      await fakeDb['transactions'].insert(seedTransaction({ categoryId: 'salary', amount: 4000 }));

      await store.refresh();

      const impliedTopLevel = store.rows().find((r) => r.categoryId === 'income');
      expect(impliedTopLevel?.implied).toBe(true);
      expect(store.incomeSectionRows().map((r) => r.categoryId)).toEqual(['salary']);
    });

    it('keeps an implied top-level Income row when 2+ top-level income categories exist', async () => {
      await fakeDb['categories'].bulkInsert([
        seedCategory({ id: 'income', name: 'Income', type: 'income' }),
        seedCategory({ id: 'salary', name: 'Salary', parentCategoryId: 'income', type: 'income' }),
        seedCategory({ id: 'interest', name: 'Interest', type: 'income' }),
      ]);
      await fakeDb['budgets'].bulkInsert([
        seedBudget({ id: 'b-salary', categoryId: 'salary', amount: 4000 }),
        seedBudget({ id: 'b-interest', categoryId: 'interest', amount: 50 }),
      ]);
      await fakeDb['transactions'].bulkInsert([
        seedTransaction({ id: 't-salary', categoryId: 'salary', amount: 4000 }),
        seedTransaction({ id: 't-interest', categoryId: 'interest', amount: 50 }),
      ]);

      await store.refresh();

      expect(store.incomeSectionRows().map((r) => r.categoryId).sort()).toEqual(['income', 'interest', 'salary'].sort());
    });

    it('keeps a top-level Income row that carries an explicit (non-implied) budget of its own', async () => {
      await fakeDb['categories'].bulkInsert([
        seedCategory({ id: 'income', name: 'Income', type: 'income' }),
        seedCategory({ id: 'salary', name: 'Salary', parentCategoryId: 'income', type: 'income' }),
      ]);
      await fakeDb['budgets'].bulkInsert([
        seedBudget({ id: 'b-income', categoryId: 'income', amount: 100 }),
        seedBudget({ id: 'b-salary', categoryId: 'salary', amount: 4000 }),
      ]);
      await fakeDb['transactions'].insert(seedTransaction({ categoryId: 'salary', amount: 4000 }));

      await store.refresh();

      expect(store.incomeSectionRows().map((r) => r.categoryId).sort()).toEqual(['income', 'salary']);
    });
  });

  describe('income bar color before the final week (issue #21)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('is a neutral "info" state with more than a week left in the month', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-10T00:00:00Z'));

      await fakeDb['categories'].insert(seedCategory({ id: 'paycheck', name: 'Paycheck', type: 'income' }));
      await fakeDb['budgets'].insert(seedBudget({ categoryId: 'paycheck', amount: 4000 }));
      await fakeDb['transactions'].insert(seedTransaction({ categoryId: 'paycheck', amount: 1000 }));

      await store.refresh();

      expect(store.rows()[0].state).toBe('info');
    });

    it('resumes real green/amber/red state during the final week of the month', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-28T00:00:00Z'));

      await fakeDb['categories'].insert(seedCategory({ id: 'paycheck', name: 'Paycheck', type: 'income' }));
      await fakeDb['budgets'].insert(seedBudget({ categoryId: 'paycheck', amount: 4000 }));
      await fakeDb['transactions'].insert(seedTransaction({ categoryId: 'paycheck', amount: 1000 }));

      await store.refresh();

      // 1000/4000 = 25%, below the 70% income warning threshold — a real "behind target" state.
      expect(store.rows()[0].state).toBe('over');
    });
  });
});
