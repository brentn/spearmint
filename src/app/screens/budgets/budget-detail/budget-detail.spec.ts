import { Component, signal, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from '../../../data/models';
import { type BudgetRowViewModel, BudgetsStore } from '../../../budgets/budgets.store';
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
    available: 400,
    spent: 0,
    percent: 0,
    pctRounded: 0,
    barPercent: 0,
    pctLabelOnFill: false,
    state: 'normal',
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
  private readonly transactionsByCategory = new Map<string, Transaction[]>();

  setTransactionTree(categoryId: string, transactions: Transaction[]): void {
    this.transactionsByCategory.set(categoryId, transactions);
  }

  transactionsForCategoryTree(categoryId: string): Transaction[] {
    return this.transactionsByCategory.get(categoryId) ?? [];
  }

  readonly addBudget = vi.fn(async (_categoryId: string, _amount: number, _rollOver: boolean) => {});
  readonly updateBudget = vi.fn(async (_id: string, _amount: number, _rollOver: boolean) => {});
  readonly deleteBudget = vi.fn(async (_id: string) => {});
}

@Component({ selector: 'app-stub-budgets-list', template: '' })
class StubBudgetsList {}

describe('BudgetDetail', () => {
  let fakeStore: FakeBudgetsStore;

  function createFixture(id: string) {
    TestBed.configureTestingModule({
      imports: [BudgetDetail],
      providers: [provideZonelessChangeDetection(), provideRouter([{ path: 'budgets', component: StubBudgetsList }])],
    });
    fakeStore = new FakeBudgetsStore();
    TestBed.overrideComponent(BudgetDetail, {
      set: { providers: [{ provide: BudgetsStore, useValue: fakeStore }] },
    });
    const fixture = TestBed.createComponent(BudgetDetail);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows the combined subcategories breakdown, combined transactions and add-budget action for an implied parent', () => {
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

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Transportation');
    expect(text).toContain('computed');
    expect(text).toContain('Auto Payment'); // subcategories breakdown lists the budgeted child
    expect(text).toContain('Car payment'); // combined transaction list
    expect(text).toContain('Add a budget for this category');
    expect(text).not.toContain('Edit budget');
  });

  it('submitting the implied-parent add-budget form calls addBudget and, once it succeeds, returns to the Budgets list', async () => {
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
    root.querySelector<HTMLButtonElement>('.budget-detail__edit-button')?.click();
    fixture.detectChanges();

    const amountInput = root.querySelector<HTMLInputElement>('.budget-detail__edit-label input[type="number"]');
    expect(amountInput).toBeTruthy();
    amountInput!.value = '250';
    amountInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('.budget-detail__save')?.click();
    await vi.waitFor(() => expect(fakeStore.addBudget).toHaveBeenCalledWith('transportation', 250, false));
    await vi.waitFor(() => expect(navigateSpy).toHaveBeenCalledWith(['/budgets']));
  });

  it('for a real budget with a budgeted child, lists the child in Subcategories and shows the combined transaction list', () => {
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

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Rent'); // subcategories breakdown
    expect(text).toContain('Housing direct');
    expect(text).toContain('Rent payment');
    expect(text).toContain('Edit budget');
    expect(text).not.toContain('Add a budget for this category');
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
    root.querySelector<HTMLButtonElement>('.budget-detail__edit-button')?.click();
    fixture.detectChanges();

    const amountInput = root.querySelector<HTMLInputElement>('.budget-detail__edit-label input[type="number"]');
    expect(amountInput!.value).toBe('300'); // prefilled with ownAmount, not the combined 1800

    root.querySelector<HTMLButtonElement>('.budget-detail__save')?.click();
    await vi.waitFor(() => expect(fakeStore.updateBudget).toHaveBeenCalledWith('b-housing', 300, false));
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
    expect(text).toContain('Edit budget');
  });
});
