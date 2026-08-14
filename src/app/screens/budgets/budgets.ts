import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { BudgetsStore } from '../../budgets/budgets.store';
import type { CategoryType } from '../../data/models';

@Component({
  selector: 'app-budgets',
  imports: [RouterLink, FaIconComponent, DecimalPipe],
  templateUrl: './budgets.html',
  styleUrl: './budgets.scss',
  providers: [BudgetsStore],
})
export class Budgets {
  protected readonly store = inject(BudgetsStore);
  protected readonly icons = { add: faPlus };

  protected readonly showAddForm = signal(false);
  protected readonly newCategoryId = signal('');
  protected readonly newAmount = signal<number | null>(null);
  protected readonly newRollOver = signal(false);

  protected selectedCategoryType(): CategoryType | null {
    const categoryId = this.newCategoryId();
    if (!categoryId) {
      return null;
    }
    return this.store.categoriesWithoutCurrentBudget().find((c) => c.id === categoryId)?.type ?? null;
  }

  protected toggleAddForm(): void {
    this.showAddForm.update((visible) => !visible);
    if (!this.showAddForm()) {
      this.resetAddForm();
    }
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
      this.resetAddForm();
      this.showAddForm.set(false);
    }
  }

  /** Bar heights for the cash-flow comparison, scaled against whichever of earned/spent is larger. */
  protected flowBarHeight(value: number): number {
    const aggregate = this.store.aggregate();
    const maxFlow = Math.max(aggregate.earned, aggregate.spent, 1);
    return Math.max((value / maxFlow) * 70, 4);
  }

  private resetAddForm(): void {
    this.newCategoryId.set('');
    this.newAmount.set(null);
    this.newRollOver.set(false);
  }
}
