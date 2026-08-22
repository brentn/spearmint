import { DecimalPipe } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faChevronLeft, faChevronRight, faPlus } from '@fortawesome/free-solid-svg-icons';
import { BudgetRow } from '../../budgets/budget-row/budget-row';
import { BudgetsStore } from '../../budgets/budgets.store';
import { FlowProgress } from '../../budgets/flow-progress/flow-progress';
import { FlowProgressBar } from '../../budgets/flow-progress/flow-progress-bar';
import { isYearMonth } from '../../budgets/period.util';
import type { CategoryType } from '../../data/models';

@Component({
  selector: 'app-budgets',
  imports: [FaIconComponent, DecimalPipe, BudgetRow, FlowProgress, FlowProgressBar],
  templateUrl: './budgets.html',
  styleUrl: './budgets.scss',
  providers: [BudgetsStore],
})
export class Budgets {
  protected readonly store = inject(BudgetsStore);
  protected readonly icons = { add: faPlus, previous: faChevronLeft, next: faChevronRight };

  /** Optional ?period= query param carried from a Budget Detail "← Budgets" link (issue #23
   * follow-up) — seeds the store's period on entry so backing out of a past month's detail view
   * returns to that same month instead of resetting to the current one. Ignored if malformed. */
  readonly period = input<string>();

  private readonly addDialog = viewChild<ElementRef<HTMLDialogElement>>('addDialog');
  protected readonly newCategoryId = signal('');
  protected readonly newAmount = signal<number | null>(null);
  protected readonly newRollOver = signal(false);
  protected readonly showChildBudgets = signal(false);

  constructor() {
    // Seeds the store's period from the incoming query param (see `period` above) — runs once
    // on entry and again if the param itself changes, but never fights the </>-chevron clicks
    // below since those mutate store.period directly without touching this input.
    effect(() => {
      const incoming = this.period();
      if (incoming && isYearMonth(incoming)) {
        this.store.period.set(incoming);
      }
    });
  }

  /** Hides a sole implied top-level Income rollup row when appropriate (issue #42) — see
   * BudgetsStore.incomeSectionRows. */
  protected readonly incomeRows = computed(() => this.store.incomeSectionRows());
  protected readonly expenseRows = computed(() => this.store.rows().filter((r) => r.categoryType !== 'income'));
  protected readonly visibleExpenseRows = computed(() =>
    this.expenseRows().filter((r) => this.showChildBudgets() || !r.parentCategoryId),
  );
  protected readonly hasChildExpenseBudgets = computed(() => this.expenseRows().some((r) => r.parentCategoryId));

  /** Cash-flow box figures (issue #21) — budgeted totals come from top-level rows only,
   * mirroring aggregate()'s own no-double-counting rule. */
  protected readonly cashFlowData = computed(() => ({
    earned: this.store.aggregate().earned,
    spent: this.store.aggregate().spent,
    budgetedIncome: this.store.aggregate().budgetedIncome,
    budgetedExpenses: this.store.aggregate().totalBudget,
  }));

  /** How far actual earned/spent overshoots what was budgeted — rendered as a grey extension
   * stacked on top of the budgeted bar (issue #21), zero whenever actual stays within budget. */
  protected readonly incomeOverage = computed(() =>
    Math.max(0, this.cashFlowData().earned - this.cashFlowData().budgetedIncome),
  );
  protected readonly expenseOverage = computed(() =>
    Math.max(0, this.cashFlowData().spent - this.cashFlowData().budgetedExpenses),
  );

  protected selectedCategoryType(): CategoryType | null {
    const categoryId = this.newCategoryId();
    if (!categoryId) {
      return null;
    }
    return this.store.categoriesWithoutCurrentBudget().find((c) => c.id === categoryId)?.type ?? null;
  }

  protected openAddDialog(): void {
    this.addDialog()?.nativeElement.showModal();
  }

  protected closeAddDialog(): void {
    this.addDialog()?.nativeElement.close();
  }

  /** Fires on any dialog close — Cancel or the imperative close() above — so the form resets
   * however the dialog was dismissed. */
  protected onAddDialogClose(): void {
    this.resetAddForm();
  }

  protected async submitAdd(): Promise<void> {
    const categoryId = this.newCategoryId();
    const amount = this.newAmount();
    if (!categoryId || amount === null || amount < 0) {
      return;
    }
    const rollOver = this.selectedCategoryType() === 'income' ? false : this.newRollOver();
    await this.store.addBudget(categoryId, amount, rollOver);
    if (!this.store.error()) {
      this.closeAddDialog();
    }
  }

  /** Bar heights for the cash-flow comparison, scaled against whichever of the four totals
   * (earned, spent, budgeted-income-plus-overage, budgeted-expenses-plus-overage) is largest. */
  protected flowBarHeight(value: number): number {
    return Math.max((value / this.cashFlowMax()) * 70, 4);
  }

  /** Height for the grey unbudgeted-overage cap stacked on a budgeted bar — unlike
   * flowBarHeight(), collapses to 0 (no 4px floor) when there's no overage, so the cap
   * disappears entirely rather than drawing a stray sliver above a fully-covered budget. */
  protected flowOverageHeight(value: number): number {
    return value <= 0 ? 0 : this.flowBarHeight(value);
  }

  private readonly cashFlowMax = computed(() => {
    const d = this.cashFlowData();
    return Math.max(
      d.earned,
      d.spent,
      d.budgetedIncome + this.incomeOverage(),
      d.budgetedExpenses + this.expenseOverage(),
      1,
    );
  });

  private resetAddForm(): void {
    this.newCategoryId.set('');
    this.newAmount.set(null);
    this.newRollOver.set(false);
  }
}
