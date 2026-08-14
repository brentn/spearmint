import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { type BudgetRowViewModel, BudgetsStore } from '../../../budgets/budgets.store';

@Component({
  selector: 'app-budget-detail',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './budget-detail.html',
  styleUrl: './budget-detail.scss',
  providers: [BudgetsStore],
})
export class BudgetDetail {
  readonly id = input.required<string>();

  protected readonly store = inject(BudgetsStore);
  private readonly router = inject(Router);

  protected readonly row = computed<BudgetRowViewModel | undefined>(() =>
    this.store.rows().find((row) => row.id === this.id()),
  );

  protected readonly editing = signal(false);
  protected readonly editAmount = signal<number | null>(null);
  protected readonly editRollOver = signal(false);

  protected startEdit(): void {
    const row = this.row();
    if (!row) {
      return;
    }
    this.editAmount.set(row.amount);
    this.editRollOver.set(row.rollOver);
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
  }

  protected async saveEdit(): Promise<void> {
    const row = this.row();
    const amount = this.editAmount();
    if (!row || amount === null || amount < 0) {
      return;
    }
    const rollOver = row.categoryType === 'income' ? false : this.editRollOver();
    await this.store.updateBudget(row.id, amount, rollOver);
    if (!this.store.error()) {
      this.editing.set(false);
    }
  }

  protected async deleteBudget(): Promise<void> {
    const row = this.row();
    if (!row) {
      return;
    }
    await this.store.deleteBudget(row.id);
    await this.router.navigate(['/budgets']);
  }
}
