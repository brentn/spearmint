import { Component, computed, signal, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Category, Transaction } from '../../../data/models';
import { type BudgetRowViewModel, type BudgetsAggregate, BudgetsStore } from '../../../budgets/budgets.store';
import { TransactionsStore } from '../../transactions/transactions.store';
import { stubDialogMethods } from '../../../testing/stub-dialog-methods';
import { BudgetDetail } from './budget-detail';

function row(overrides: Partial<BudgetRowViewModel> = {}): BudgetRowViewModel {
  return {
    id: 'budget-1',
    categoryId: 'cat-1',
    categoryName: 'Category',
    categoryType: 'expense',
    parentCategoryId: null,
    amount: 400,
    ownAmount: 400,
    rollOver: false,
    rolloverAmount: 0,
    rolloverManual: false,
    available: 400,
    spent: 0,
    percent: 0,
    pctRounded: 0,
    barPercent: 0,
    pctLabelOnFill: false,
    state: 'normal',
    reversed: false,
    reversedCapped: false,
    implied: false,
    ...overrides,
  };
}

function txn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    accountId: 'acc-1',
    date: '2026-08-10',
    description: 'Test transaction',
    amount: -50,
    pending: false,
    categoryId: 'cat-1',
    excludeFromBudget: false,
    notes: null,
    ...overrides,
  };
}

function emptyAggregate(): BudgetsAggregate {
  return {
    monthName: 'August 2026',
    totalSpent: 0,
    totalBudget: 0,
    remaining: 0,
    overallPercent: 0,
    overallBarPercent: 0,
    overallState: 'normal',
    message: '',
    todayPercent: 0,
    earned: 0,
    spent: 0,
    cashFlowNet: 0,
    budgetedIncome: 0,
  };
}

/**
 * Component-level tests exercise BudgetDetail's template wiring only (subcategories breakdown,
 * combined transaction list, implied-vs-real actions) — the underlying rollup/combination math
 * is already covered by budget-engine.util.spec.ts and budgets.store.spec.ts. A fake, synchronous
 * store keeps this deterministic without re-driving a real RxDB-backed store through this screen.
 */
class FakeBudgetsStore {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly rows = signal<BudgetRowViewModel[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly aggregate = signal<BudgetsAggregate>(emptyAggregate());
  readonly period = signal('2026-08');
  readonly isCurrentPeriod = signal(true);
  readonly monthPhrase = computed(() => (this.isCurrentPeriod() ? 'this month' : `in ${this.aggregate().monthName}`));
  readonly linkQueryParams = computed(() => (this.isCurrentPeriod() ? undefined : { period: this.period() }));
  private readonly transactionsByCategory = new Map<string, Transaction[]>();

  setTransactionTree(categoryId: string, transactions: Transaction[]): void {
    this.transactionsByCategory.set(categoryId, transactions);
  }

  transactionsForCategoryTree(categoryId: string): Transaction[] {
    return this.transactionsByCategory.get(categoryId) ?? [];
  }

  accountName(_accountId: string): string {
    return 'Checking';
  }

  readonly setBudget = vi.fn(
    async (_categoryId: string, _amount: number, _rollOver: boolean, _rolloverAmount?: number) => {},
  );
  readonly deleteBudget = vi.fn(async (_id: string) => {});
  readonly refresh = vi.fn(async () => {});
}

class FakeTransactionsStore {
  readonly assignCategory = vi.fn(async (_transactionId: string, _categoryId: string | null) => {});
  readonly setNotes = vi.fn(async (_transactionId: string, _notes: string | null) => {});
  readonly setExcludeFromBudget = vi.fn(async (_transactionId: string, _excludeFromBudget: boolean) => {});
}

@Component({ selector: 'app-stub-budgets-list', template: '' })
class StubBudgetsList {}

describe('BudgetDetail', () => {
  let fakeStore: FakeBudgetsStore;
  let fakeTransactionsStore: FakeTransactionsStore;

  beforeAll(stubDialogMethods);

  function createFixture(id: string, period?: string) {
    TestBed.configureTestingModule({
      imports: [BudgetDetail],
      providers: [provideZonelessChangeDetection(), provideRouter([{ path: 'budgets', component: StubBudgetsList }])],
    });
    fakeStore = new FakeBudgetsStore();
    fakeTransactionsStore = new FakeTransactionsStore();
    TestBed.overrideComponent(BudgetDetail, {
      set: {
        providers: [
          { provide: BudgetsStore, useValue: fakeStore },
          { provide: TransactionsStore, useValue: fakeTransactionsStore },
        ],
      },
    });
    const fixture = TestBed.createComponent(BudgetDetail);
    fixture.componentRef.setInput('id', id);
    if (period !== undefined) {
      fixture.componentRef.setInput('period', period);
    }
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows the combined subcategories breakdown, combined transactions and an add-budget icon for an implied parent', () => {
    const fixture = createFixture('implied:transportation');
    fakeStore.rows.set([
      row({
        id: 'implied:transportation',
        categoryId: 'transportation',
        categoryName: 'Transportation',
        parentCategoryId: null,
        implied: true,
        amount: 400,
        available: 400,
        spent: 150,
      }),
      row({
        id: 'b-auto',
        categoryId: 'auto-payment',
        categoryName: 'Auto Payment',
        parentCategoryId: 'transportation',
        implied: false,
        amount: 400,
        available: 400,
        spent: 150,
      }),
    ]);
    fakeStore.setTransactionTree('transportation', [txn({ description: 'Car payment' })]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(text).toContain('Transportation');
    expect(text).toContain('computed');
    expect(text).toContain('Auto Payment'); // subcategories breakdown lists the budgeted child
    expect(text).toContain('Car payment'); // combined transaction list
    expect(root.querySelector('button[aria-label="Add a budget for this category"]')).toBeTruthy();
    expect(root.querySelector('button[aria-label="Edit budget"]')).toBeNull();
  });

  it('submitting the implied-parent add-budget dialog calls setBudget and, once it succeeds, returns to the Budgets list', async () => {
    const fixture = createFixture('implied:transportation');
    fakeStore.rows.set([
      row({
        id: 'implied:transportation',
        categoryId: 'transportation',
        categoryName: 'Transportation',
        implied: true,
      }),
    ]);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button[aria-label="Add a budget for this category"]')?.click();
    fixture.detectChanges();

    const dialog = root.querySelector<HTMLDialogElement>('.budget-detail__dialog');
    expect(dialog?.hasAttribute('open')).toBe(true);

    const amountInput = root.querySelector<HTMLInputElement>('.budget-detail__edit-label input[type="number"]');
    expect(amountInput).toBeTruthy();
    amountInput!.value = '250';
    amountInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('.budget-detail__save')?.click();
    await vi.waitFor(() => expect(fakeStore.setBudget).toHaveBeenCalledWith('transportation', 250, false, undefined));
    await vi.waitFor(() => expect(navigateSpy).toHaveBeenCalledWith(['/budgets'], { queryParams: undefined }));
  });

  it('for a real budget with a budgeted child, lists the child in Subcategories, shows the combined transaction list, and offers an edit icon (no add icon)', () => {
    const fixture = createFixture('b-housing');
    fakeStore.rows.set([
      row({
        id: 'b-housing',
        categoryId: 'housing',
        categoryName: 'Housing',
        implied: false,
        spent: 1520,
        available: 1800,
      }),
      row({
        id: 'b-rent',
        categoryId: 'rent',
        categoryName: 'Rent',
        parentCategoryId: 'housing',
        implied: false,
        spent: 1500,
      }),
    ]);
    fakeStore.setTransactionTree('housing', [
      txn({ id: 't-housing', description: 'Housing direct' }),
      txn({ id: 't-rent', description: 'Rent payment' }),
    ]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(text).toContain('Rent'); // subcategories breakdown
    expect(text).toContain('Housing direct');
    expect(text).toContain('Rent payment');
    expect(root.querySelector('button[aria-label="Edit budget"]')).toBeTruthy();
    expect(root.querySelector('button[aria-label="Add a budget for this category"]')).toBeNull();
  });

  it("editing a real budget with a budgeted child prefills and saves the category's own amount, not the combined total", async () => {
    const fixture = createFixture('b-housing');
    fakeStore.rows.set([
      row({
        id: 'b-housing',
        categoryId: 'housing',
        categoryName: 'Housing',
        implied: false,
        amount: 1800, // combined: 300 own + 1500 from budgeted child Rent
        ownAmount: 300,
        spent: 1520,
        available: 1800,
      }),
      row({
        id: 'b-rent',
        categoryId: 'rent',
        categoryName: 'Rent',
        parentCategoryId: 'housing',
        implied: false,
        amount: 1500,
        ownAmount: 1500,
        spent: 1500,
      }),
    ]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button[aria-label="Edit budget"]')?.click();
    fixture.detectChanges();

    const amountInput = root.querySelector<HTMLInputElement>('.budget-detail__edit-label input[type="number"]');
    expect(amountInput!.value).toBe('300'); // prefilled with ownAmount, not the combined 1800

    root.querySelector<HTMLButtonElement>('.budget-detail__save')?.click();
    await vi.waitFor(() => expect(fakeStore.setBudget).toHaveBeenCalledWith('housing', 300, false, undefined));
  });

  it("for a leaf child's own detail screen, shows no subcategories section and only its own transactions", () => {
    const fixture = createFixture('b-rent');
    fakeStore.rows.set([
      row({ id: 'b-housing', categoryId: 'housing', categoryName: 'Housing', implied: false }),
      row({ id: 'b-rent', categoryId: 'rent', categoryName: 'Rent', parentCategoryId: 'housing', implied: false }),
    ]);
    fakeStore.setTransactionTree('rent', [txn({ id: 't-rent', description: 'Rent payment' })]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.budget-detail__subcat-list')).toBeNull();
    const text = root.textContent ?? '';
    expect(text).toContain('Rent payment');
    expect(root.querySelector('button[aria-label="Edit budget"]')).toBeTruthy();
  });

  it('the edit dialog offers a delete-budget action that deletes the budget and returns to the Budgets list', async () => {
    const fixture = createFixture('b-housing');
    fakeStore.rows.set([row({ id: 'b-housing', categoryId: 'housing', categoryName: 'Housing', implied: false })]);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button[aria-label="Edit budget"]')?.click();
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('.budget-detail__delete-button')?.click();
    await vi.waitFor(() => expect(fakeStore.deleteBudget).toHaveBeenCalledWith('b-housing'));
    await vi.waitFor(() => expect(navigateSpy).toHaveBeenCalledWith(['/budgets']));
  });

  it('the add-budget dialog does not offer a delete action (nothing exists yet to delete)', () => {
    const fixture = createFixture('implied:transportation');
    fakeStore.rows.set([
      row({ id: 'implied:transportation', categoryId: 'transportation', categoryName: 'Transportation', implied: true }),
    ]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button[aria-label="Add a budget for this category"]')?.click();
    fixture.detectChanges();

    expect(root.querySelector('.budget-detail__delete-button')).toBeNull();
  });

  it('shows category transactions with a leading minus for spend and green for deposits, matching the Transactions screen', () => {
    const fixture = createFixture('b-housing');
    fakeStore.rows.set([row({ id: 'b-housing', categoryId: 'housing', categoryName: 'Housing', implied: false })]);
    fakeStore.setTransactionTree('housing', [
      txn({ id: 't-spend', description: 'Spend', amount: -75 }),
      txn({ id: 't-deposit', description: 'Deposit', amount: 40 }),
    ]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const rows = [...root.querySelectorAll('.budget-detail__txn-row')];
    const spendAmt = rows.find((r) => r.textContent?.includes('Spend'))?.querySelector('.budget-detail__txn-amt');
    const depositAmt = rows.find((r) => r.textContent?.includes('Deposit'))?.querySelector('.budget-detail__txn-amt');

    expect(spendAmt?.textContent?.trim()).toBe('-$75.00');
    expect(spendAmt?.classList.contains('budget-detail__txn-amt--positive')).toBe(false);
    expect(depositAmt?.textContent?.trim()).toBe('$40.00');
    expect(depositAmt?.classList.contains('budget-detail__txn-amt--positive')).toBe(true);
  });

  describe('manual rollover override', () => {
    it('shows the rollover amount field only once rollOver is checked, and hides income entirely', () => {
      const fixture = createFixture('b-housing');
      fakeStore.rows.set([
        row({ id: 'b-housing', categoryId: 'housing', categoryName: 'Housing', implied: false, rollOver: false }),
      ]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      root.querySelector<HTMLButtonElement>('button[aria-label="Edit budget"]')?.click();
      fixture.detectChanges();

      const labels = () => [...root.querySelectorAll('.budget-detail__edit-label')];
      expect(labels()).toHaveLength(1); // just "Amount" — no rollover override field yet

      const rollOverCheckbox = root.querySelector<HTMLInputElement>('.budget-detail__edit-checkbox input');
      rollOverCheckbox!.checked = true;
      rollOverCheckbox!.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(labels()).toHaveLength(2);
    });

    it('typing a rollover amount passes it through to setBudget', async () => {
      const fixture = createFixture('b-housing');
      fakeStore.rows.set([
        row({ id: 'b-housing', categoryId: 'housing', categoryName: 'Housing', implied: false, rollOver: true }),
      ]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      root.querySelector<HTMLButtonElement>('button[aria-label="Edit budget"]')?.click();
      fixture.detectChanges();

      const rolloverInput = [...root.querySelectorAll<HTMLInputElement>('.budget-detail__edit-label input')][1];
      rolloverInput.value = '-60';
      rolloverInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      root.querySelector<HTMLButtonElement>('.budget-detail__save')?.click();
      await vi.waitFor(() => expect(fakeStore.setBudget).toHaveBeenCalledWith('housing', 400, true, -60));
    });

    it('leaving the rollover amount blank never sends a rolloverAmount for a not-yet-manual row', async () => {
      const fixture = createFixture('b-housing');
      fakeStore.rows.set([
        row({ id: 'b-housing', categoryId: 'housing', categoryName: 'Housing', implied: false, rollOver: true }),
      ]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      root.querySelector<HTMLButtonElement>('button[aria-label="Edit budget"]')?.click();
      fixture.detectChanges();

      root.querySelector<HTMLButtonElement>('.budget-detail__save')?.click();
      await vi.waitFor(() => expect(fakeStore.setBudget).toHaveBeenCalledWith('housing', 400, true, undefined));
    });

    it('prefills the rollover amount for an already-manual row, and resaving it unchanged keeps it manual', async () => {
      const fixture = createFixture('b-housing');
      fakeStore.rows.set([
        row({
          id: 'b-housing',
          categoryId: 'housing',
          categoryName: 'Housing',
          implied: false,
          rollOver: true,
          rolloverAmount: -60,
          rolloverManual: true,
        }),
      ]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      root.querySelector<HTMLButtonElement>('button[aria-label="Edit budget"]')?.click();
      fixture.detectChanges();

      // Prefilled with the existing manual value — there's no field to uncheck back to
      // automatic (Q11: sticky, permanent) once a period has been manually set.
      const rolloverInput = [...root.querySelectorAll<HTMLInputElement>('.budget-detail__edit-label input')][1];
      expect(rolloverInput.value).toBe('-60');

      root.querySelector<HTMLButtonElement>('.budget-detail__save')?.click();
      await vi.waitFor(() => expect(fakeStore.setBudget).toHaveBeenCalledWith('housing', 400, true, -60));
    });
  });

  describe('period-aware navigation (issue #23 follow-up)', () => {
    it('seeds the store\'s period from an incoming ?period= query param', () => {
      createFixture('b-housing', '2026-06');
      expect(fakeStore.period()).toBe('2026-06');
    });

    it('ignores a malformed period query param, leaving the store\'s default in place', () => {
      createFixture('b-housing', 'not-a-period');
      expect(fakeStore.period()).toBe('2026-08');
    });

    it('keeps the edit/add-budget controls available while viewing a non-current period (backdating)', () => {
      const fixture = createFixture('b-housing', '2026-06');
      fakeStore.isCurrentPeriod.set(false);
      fakeStore.rows.set([row({ id: 'b-housing', categoryId: 'housing', categoryName: 'Housing', implied: false })]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('button[aria-label="Edit budget"]')).toBeTruthy();
    });

    it('editing a budget while viewing a past period saves against that viewed period, not the current one', async () => {
      const fixture = createFixture('b-housing', '2026-06');
      fakeStore.isCurrentPeriod.set(false);
      fakeStore.rows.set([
        row({ id: 'b-housing', categoryId: 'housing', categoryName: 'Housing', implied: false, ownAmount: 200 }),
      ]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      root.querySelector<HTMLButtonElement>('button[aria-label="Edit budget"]')?.click();
      fixture.detectChanges();
      root.querySelector<HTMLButtonElement>('.budget-detail__save')?.click();

      // The store's setBudget targets whichever period it's currently viewing internally —
      // this screen never passes a period explicitly, it just calls through.
      await vi.waitFor(() => expect(fakeStore.setBudget).toHaveBeenCalledWith('housing', 200, false, undefined));
    });

    it('adding a backdated budget for a never-budgeted category navigates back carrying the viewed period', async () => {
      const fixture = createFixture('implied:transportation', '2026-06');
      fakeStore.isCurrentPeriod.set(false);
      fakeStore.rows.set([
        row({ id: 'implied:transportation', categoryId: 'transportation', categoryName: 'Transportation', implied: true }),
      ]);
      fixture.detectChanges();
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      const root = fixture.nativeElement as HTMLElement;
      root.querySelector<HTMLButtonElement>('button[aria-label="Add a budget for this category"]')?.click();
      fixture.detectChanges();
      const amountInput = root.querySelector<HTMLInputElement>('.budget-detail__edit-label input[type="number"]');
      amountInput!.value = '150';
      amountInput!.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      root.querySelector<HTMLButtonElement>('.budget-detail__save')?.click();

      await vi.waitFor(() =>
        expect(navigateSpy).toHaveBeenCalledWith(['/budgets'], { queryParams: { period: '2026-06' } }),
      );
    });

    it('names the viewed month instead of always saying "this month" once it\'s not the current period', () => {
      const fixture = createFixture('b-housing', '2026-06');
      fakeStore.isCurrentPeriod.set(false);
      fakeStore.aggregate.set({ ...emptyAggregate(), monthName: 'June 2026' });
      fakeStore.rows.set([row({ id: 'b-housing', categoryId: 'housing', categoryName: 'Housing', implied: false })]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      expect(root.textContent).toContain('Spent in June 2026');
      expect(root.textContent).not.toContain('Spent this month');
    });

    it('names the viewed month on an income row too, not just expense rows', () => {
      const fixture = createFixture('b-paycheck', '2026-06');
      fakeStore.isCurrentPeriod.set(false);
      fakeStore.aggregate.set({ ...emptyAggregate(), monthName: 'June 2026' });
      fakeStore.rows.set([
        row({ id: 'b-paycheck', categoryId: 'paycheck', categoryName: 'Paycheck', categoryType: 'income', implied: false }),
      ]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      expect(root.textContent).toContain('Target vs. actual in June 2026');
      expect(root.textContent).not.toContain('Target vs. actual this month');
    });

    it('names the viewed month in the empty transactions note instead of always saying "this month"', () => {
      const fixture = createFixture('b-housing', '2026-06');
      fakeStore.isCurrentPeriod.set(false);
      fakeStore.aggregate.set({ ...emptyAggregate(), monthName: 'June 2026' });
      fakeStore.rows.set([row({ id: 'b-housing', categoryId: 'housing', categoryName: 'Housing', implied: false })]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      expect(root.textContent).toContain('No transactions in this category in June 2026.');
    });

    it('the "← Budgets" back link carries the viewed period, so backing out doesn\'t lose it', () => {
      const fixture = createFixture('b-housing', '2026-06');
      fakeStore.isCurrentPeriod.set(false);
      fakeStore.rows.set([row({ id: 'b-housing', categoryId: 'housing', categoryName: 'Housing', implied: false })]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      const backLink = root.querySelector<HTMLAnchorElement>('.budget-detail__back');
      expect(backLink?.getAttribute('href')).toBe('/budgets?period=2026-06');
    });

    it('the back link stays a plain /budgets link for the current period', () => {
      const fixture = createFixture('b-housing');
      fakeStore.rows.set([row({ id: 'b-housing', categoryId: 'housing', categoryName: 'Housing', implied: false })]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      const backLink = root.querySelector<HTMLAnchorElement>('.budget-detail__back');
      expect(backLink?.getAttribute('href')).toBe('/budgets');
    });

    it('a subcategory link carries the viewed period along too', () => {
      const fixture = createFixture('b-housing', '2026-06');
      fakeStore.isCurrentPeriod.set(false);
      fakeStore.rows.set([
        row({ id: 'b-housing', categoryId: 'housing', categoryName: 'Housing', implied: false }),
        row({ id: 'b-rent', categoryId: 'rent', categoryName: 'Rent', parentCategoryId: 'housing', implied: false }),
      ]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      const subcatLink = root.querySelector<HTMLAnchorElement>('.budget-detail__subcat-row');
      expect(subcatLink?.getAttribute('href')).toBe('/budgets/b-rent?period=2026-06');
    });
  });

  describe('transaction edit dialog (issue #19)', () => {
    it('clicking a transaction row opens the edit dialog', () => {
      const fixture = createFixture('b-housing');
      fakeStore.rows.set([row({ id: 'b-housing', categoryId: 'housing', categoryName: 'Housing', implied: false })]);
      fakeStore.setTransactionTree('housing', [txn({ id: 't-1', description: 'Groceries' })]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('app-transaction-edit-dialog')).toBeNull();

      root.querySelector<HTMLElement>('.budget-detail__txn-row')?.click();
      fixture.detectChanges();

      expect(root.querySelector('app-transaction-edit-dialog')).toBeTruthy();
    });

    it("the dialog's save output calls TransactionsStore's mutation methods, then refreshes BudgetsStore and closes the dialog", async () => {
      const fixture = createFixture('b-housing');
      fakeStore.rows.set([row({ id: 'b-housing', categoryId: 'housing', categoryName: 'Housing', implied: false })]);
      fakeStore.setTransactionTree('housing', [txn({ id: 't-1', description: 'Groceries', categoryId: 'housing' })]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      root.querySelector<HTMLElement>('.budget-detail__txn-row')?.click();
      fixture.detectChanges();

      root.querySelector<HTMLButtonElement>('.transaction-edit-dialog__save')?.click();
      await vi.waitFor(() => expect(fakeTransactionsStore.assignCategory).toHaveBeenCalledWith('t-1', 'housing'));
      await vi.waitFor(() => expect(fakeTransactionsStore.setNotes).toHaveBeenCalledWith('t-1', null));
      await vi.waitFor(() => expect(fakeTransactionsStore.setExcludeFromBudget).toHaveBeenCalledWith('t-1', false));
      await vi.waitFor(() => expect(fakeStore.refresh).toHaveBeenCalled());
      fixture.detectChanges();
      expect(root.querySelector('app-transaction-edit-dialog')).toBeNull();
    });

    it("the dialog's close output closes the dialog without calling any mutation method", () => {
      const fixture = createFixture('b-housing');
      fakeStore.rows.set([row({ id: 'b-housing', categoryId: 'housing', categoryName: 'Housing', implied: false })]);
      fakeStore.setTransactionTree('housing', [txn({ id: 't-1', description: 'Groceries' })]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      root.querySelector<HTMLElement>('.budget-detail__txn-row')?.click();
      fixture.detectChanges();

      root.querySelector<HTMLButtonElement>('.transaction-edit-dialog__cancel')?.click();
      fixture.detectChanges();

      expect(root.querySelector('app-transaction-edit-dialog')).toBeNull();
      expect(fakeTransactionsStore.assignCategory).not.toHaveBeenCalled();
    });
  });
});
