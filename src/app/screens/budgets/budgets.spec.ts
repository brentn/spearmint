import { Component, computed, signal, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Category } from '../../data/models';
import type { FlowProgressRow } from '../../budgets/budget-engine.util';
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
    reversed: false,
    reversedCapped: false,
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
  budgetedIncome: 0,
};

const emptyFlowProgressRow: FlowProgressRow = {
  categorizedActual: 0,
  uncategorizedActual: 0,
  totalActual: 0,
  budget: 0,
  barPercent: 0,
  state: 'normal',
  reversed: false,
  reversedCapped: false,
  zeroBudget: true,
};

/** Component-level test for the toggle only — row-shape/aggregate math is already covered by
 * budgets.store.spec.ts and budget-engine.util.spec.ts. */
class FakeBudgetsStore {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly rows = signal<BudgetRowViewModel[]>([]);
  readonly aggregate = signal<BudgetsAggregate>(emptyAggregate);
  readonly incomeSectionRows = signal<BudgetRowViewModel[]>([]);
  readonly flowProgress = signal({ income: emptyFlowProgressRow, expenses: emptyFlowProgressRow });
  readonly isCurrentPeriod = signal(true);
  readonly canGoToPreviousMonth = signal(true);
  readonly canGoToNextMonth = signal(false);
  readonly period = signal('2026-08');
  readonly monthPhrase = computed(() => (this.isCurrentPeriod() ? 'this month' : `in ${this.aggregate().monthName}`));
  readonly linkQueryParams = computed(() => (this.isCurrentPeriod() ? undefined : { period: this.period() }));
  categoriesForAdd: Category[] = [];

  categoriesWithoutCurrentBudget(): Category[] {
    return this.categoriesForAdd;
  }

  readonly addBudget = vi.fn(async (_categoryId: string, _amount: number, _rollOver: boolean) => {});
  readonly goToPreviousMonth = vi.fn(() => {});
  readonly goToNextMonth = vi.fn(() => {});
}

@Component({ selector: 'app-stub-budget-detail', template: '' })
class StubBudgetDetail {}

describe('Budgets', () => {
  beforeAll(stubDialogMethods);

  function createFixture(period?: string) {
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
    if (period !== undefined) {
      fixture.componentRef.setInput('period', period);
    }
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

  it('month nav buttons call the store and reflect its canGo*/isCurrentPeriod signals (issue #23)', () => {
    const { fixture, fakeStore } = createFixture();
    fakeStore.canGoToPreviousMonth.set(true);
    fakeStore.canGoToNextMonth.set(false);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const prevBtn = root.querySelector<HTMLButtonElement>('[aria-label="Previous month"]');
    const nextBtn = root.querySelector<HTMLButtonElement>('[aria-label="Next month"]');
    expect(prevBtn?.disabled).toBe(false);
    expect(nextBtn?.disabled).toBe(true);

    prevBtn?.click();
    expect(fakeStore.goToPreviousMonth).toHaveBeenCalled();
  });

  it('hides the "Add a budget" button and the Today tick when viewing a past month (issue #23)', () => {
    const { fixture, fakeStore } = createFixture();
    fakeStore.rows.set([row()]);
    fakeStore.isCurrentPeriod.set(false);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[aria-label="Add a budget"]')).toBeNull();
    expect(root.querySelector('.flow-progress-bar__today-tick')).toBeNull();
  });

  it('opens the add-budget dialog from the hero "+" button, closed by default', () => {
    const { fixture } = createFixture();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const dialog = root.querySelector<HTMLDialogElement>('.budgets__dialog');
    expect(dialog?.hasAttribute('open')).toBe(false);

    root.querySelector<HTMLButtonElement>('[aria-label="Add a budget"]')?.click();
    fixture.detectChanges();

    expect(dialog?.hasAttribute('open')).toBe(true);
  });

  it('submitting the add-budget dialog calls addBudget with the selected category and amount, then closes the dialog', async () => {
    const { fixture, fakeStore } = createFixture();
    fakeStore.categoriesForAdd = [{ id: 'cat-groceries', name: 'Groceries', parentCategoryId: null, type: 'expense' }];
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('[aria-label="Add a budget"]')?.click();
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

  describe('period-aware navigation (issue #23 follow-up)', () => {
    it('seeds the store\'s period from an incoming ?period= query param', () => {
      const { fixture, fakeStore } = createFixture('2026-06');
      fixture.detectChanges();

      expect(fakeStore.period()).toBe('2026-06');
    });

    it('ignores a malformed period query param, leaving the store\'s default in place', () => {
      const { fixture, fakeStore } = createFixture('not-a-period');
      fixture.detectChanges();

      expect(fakeStore.period()).toBe('2026-08');
    });

    it('row links stay plain /budgets/:id links for the current month', () => {
      const { fixture, fakeStore } = createFixture();
      fakeStore.rows.set([row({ id: 'b-groceries', categoryId: 'groceries', categoryName: 'Groceries' })]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      const link = root.querySelector<HTMLAnchorElement>('.budget-row__link');
      expect(link?.getAttribute('href')).toBe('/budgets/b-groceries');
    });

    it('row links carry the viewed period while browsing a past month', () => {
      const { fixture, fakeStore } = createFixture();
      fakeStore.isCurrentPeriod.set(false);
      fakeStore.period.set('2026-06');
      fakeStore.rows.set([row({ id: 'b-groceries', categoryId: 'groceries', categoryName: 'Groceries' })]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      const link = root.querySelector<HTMLAnchorElement>('.budget-row__link');
      expect(link?.getAttribute('href')).toBe('/budgets/b-groceries?period=2026-06');
    });
  });
});
