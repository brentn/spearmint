import { DecimalPipe } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { BudgetRow } from '../../budgets/budget-row/budget-row';
import { BudgetsStore } from '../../budgets/budgets.store';
import type { CategoryType } from '../../data/models';
import { CashFlowPrototypeHost, type CashFlowProtoData } from './cash-flow-prototype/cash-flow-prototype';

@Component({
  selector: 'app-budgets',
  imports: [FaIconComponent, DecimalPipe, BudgetRow, CashFlowPrototypeHost],
  templateUrl: './budgets.html',
  styleUrl: './budgets.scss',
  providers: [BudgetsStore],
})
export class Budgets {
  protected readonly store = inject(BudgetsStore);
  protected readonly icons = { add: faPlus };

  private readonly addDialog = viewChild<ElementRef<HTMLDialogElement>>('addDialog');
  protected readonly newCategoryId = signal('');
  protected readonly newAmount = signal<number | null>(null);
  protected readonly newRollOver = signal(false);
  protected readonly showChildBudgets = signal(false);

  protected readonly incomeRows = computed(() => this.store.rows().filter((r) => r.categoryType === 'income'));
  protected readonly expenseRows = computed(() => this.store.rows().filter((r) => r.categoryType !== 'income'));
  protected readonly visibleExpenseRows = computed(() =>
    this.expenseRows().filter((r) => this.showChildBudgets() || !r.parentCategoryId),
  );
  protected readonly hasChildExpenseBudgets = computed(() => this.expenseRows().some((r) => r.parentCategoryId));

  /** PROTOTYPE data for the cash-flow box layout options (issue #21) — budgeted totals come from
   * top-level rows only, mirroring aggregate()'s own no-double-counting rule. */
  protected readonly cashFlowData = computed<CashFlowProtoData>(() => {
    const topLevelIncome = this.incomeRows().filter((r) => r.parentCategoryId === null);
    return {
      earned: this.store.aggregate().earned,
      spent: this.store.aggregate().spent,
      budgetedIncome: topLevelIncome.reduce((sum, r) => sum + r.available, 0),
      budgetedExpenses: this.store.aggregate().totalBudget,
    };
  });

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

  private resetAddForm(): void {
    this.newCategoryId.set('');
    this.newAmount.set(null);
    this.newRollOver.set(false);
  }
}
