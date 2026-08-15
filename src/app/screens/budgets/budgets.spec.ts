import { Component, signal, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Category } from '../../data/models';
import { type BudgetRowViewModel, type BudgetsAggregate, BudgetsStore } from '../../budgets/budgets.store';
import { stubDialogMethods } from '../../testing/stub-dialog-methods';
import { Budgets } from './budgets';

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

const emptyAggregate: BudgetsAggregate = {
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
};

/** Component-level test for the toggle only — row-shape/aggregate math is already covered by
 * budgets.store.spec.ts and budget-engine.util.spec.ts. */
class FakeBudgetsStore {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly rows = signal<BudgetRowViewModel[]>([]);
  readonly aggregate = signal<BudgetsAggregate>(emptyAggregate);
  categoriesForAdd: Category[] = [];

  categoriesWithoutCurrentBudget(): Category[] {
    return this.categoriesForAdd;
  }

  readonly addBudget = vi.fn(async (_categoryId: string, _amount: number, _rollOver: boolean) => {});
}

@Component({ selector: 'app-stub-budget-detail', template: '' })
class StubBudgetDetail {}

describe('Budgets', () => {
  beforeAll(stubDialogMethods);

  function createFixture() {
    TestBed.configureTestingModule({
      imports: [Budgets],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: 'budgets/:id', component: StubBudgetDetail }]),
      ],
    });
    const fakeStore = new FakeBudgetsStore();
    TestBed.overrideComponent(Budgets, { set: { providers: [{ provide: BudgetsStore, useValue: fakeStore }] } });
    const fixture = TestBed.createComponent(Budgets);
    return { fixture, fakeStore };
  }

  it('hides child rows and the implied parent\'s own child by default, showing them after toggling "Show subcategories"', () => {
    const { fixture, fakeStore } = createFixture();
    fakeStore.rows.set([
      row({ id: 'implied:transportation', categoryId: 'transportation', categoryName: 'Transportation', implied: true }),
      row({ id: 'b-auto', categoryId: 'auto-payment', categoryName: 'Auto Payment', parentCategoryId: 'transportation' }),
    ]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Transportation');
    expect(root.textContent).not.toContain('Auto Payment');

    root.querySelector<HTMLButtonElement>('.budgets__toggle-children')?.click();
    fixture.detectChanges();

    expect(root.textContent).toContain('Auto Payment');
  });

  it('does not show the "Show subcategories" toggle when no row has a parent', () => {
    const { fixture, fakeStore } = createFixture();
    fakeStore.rows.set([row({ id: 'b-groceries', categoryId: 'groceries', categoryName: 'Groceries' })]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.budgets__toggle-children')).toBeNull();
  });

  it('opens the add-budget dialog from the hero "+" button, closed by default', () => {
    const { fixture } = createFixture();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const dialog = root.querySelector<HTMLDialogElement>('.budgets__dialog');
    expect(dialog?.hasAttribute('open')).toBe(false);

    root.querySelector<HTMLButtonElement>('.budgets__hero-icon-btn')?.click();
    fixture.detectChanges();

    expect(dialog?.hasAttribute('open')).toBe(true);
  });

  it('submitting the add-budget dialog calls addBudget with the selected category and amount, then closes the dialog', async () => {
    const { fixture, fakeStore } = createFixture();
    fakeStore.categoriesForAdd = [{ id: 'cat-groceries', name: 'Groceries', parentCategoryId: null, type: 'expense' }];
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.budgets__hero-icon-btn')?.click();
    fixture.detectChanges();

    const select = root.querySelector<HTMLSelectElement>('.budgets__add-select');
    select!.value = 'cat-groceries';
    select!.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const amountInput = root.querySelector<HTMLInputElement>('.budgets__add-input');
    amountInput!.value = '300';
    amountInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('.budgets__add-button')?.click();
    await vi.waitFor(() => expect(fakeStore.addBudget).toHaveBeenCalledWith('cat-groceries', 300, false));

    const dialog = root.querySelector<HTMLDialogElement>('.budgets__dialog');
    await vi.waitFor(() => expect(dialog?.hasAttribute('open')).toBe(false));
  });
});
