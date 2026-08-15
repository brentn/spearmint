import { DecimalPipe } from '@angular/common';
import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faPencil, faPlus } from '@fortawesome/free-solid-svg-icons';
import { type BudgetRowViewModel, BudgetsStore } from '../../../budgets/budgets.store';
import type { Transaction } from '../../../data/models';

@Component({
  selector: 'app-budget-detail',
  imports: [RouterLink, DecimalPipe, FaIconComponent],
  templateUrl: './budget-detail.html',
  styleUrl: './budget-detail.scss',
  providers: [BudgetsStore],
})
export class BudgetDetail {
  readonly id = input.required<string>();

  protected readonly store = inject(BudgetsStore);
  private readonly router = inject(Router);
  protected readonly icons = { edit: faPencil, add: faPlus };

  protected readonly row = computed<BudgetRowViewModel | undefined>(() =>
    this.store.rows().find((row) => row.id === this.id()),
  );

  /** Transactions across this category and all of its descendants, current period only — for a
   * leaf category (no children) this is just its own transactions, same as before issue #15. */
  protected readonly categoryTransactions = computed<Transaction[]>(() => {
    const row = this.row();
    if (!row) {
      return [];
    }
    return this.store.transactionsForCategoryTree(row.categoryId);
  });

  /** Budgeted children of the tapped category, each its own mini progress row (issue #15) —
   * unbudgeted children aren't listed here, but their spend is still folded into `row`'s
   * combined total and into `categoryTransactions` above. */
  protected readonly subcategoryRows = computed<BudgetRowViewModel[]>(() => {
    const row = this.row();
    if (!row) {
      return [];
    }
    return this.store.rows().filter((r) => r.parentCategoryId === row.categoryId);
  });

  /** One shared amount/rollover form drives both "Edit budget" (a real row) and "Add a budget
   * for this category" (an implied row) — they differ only in prefill and in which store call
   * `submitForm` makes, not in shape (issue #15 turned this from one flow into a near-duplicate
   * pair, so it's collapsed back into one here). */
  private readonly formDialog = viewChild<ElementRef<HTMLDialogElement>>('formDialog');

  protected readonly formMode = signal<'edit' | 'add' | null>(null);
  protected readonly formAmount = signal<number | null>(null);
  protected readonly formRollOver = signal(false);

  protected openEditDialog(): void {
    const row = this.row();
    if (!row) {
      return;
    }
    // row.amount is the combined display total (own + budgeted descendants' amounts) — editing
    // must prefill/persist only this category's own explicit amount, or saving unchanged would
    // silently inflate it by the children's amounts on every edit.
    this.formAmount.set(row.ownAmount);
    this.formRollOver.set(row.rollOver);
    this.formMode.set('edit');
    this.formDialog()?.nativeElement.showModal();
  }

  protected openAddDialog(): void {
    this.formAmount.set(null);
    this.formRollOver.set(false);
    this.formMode.set('add');
    this.formDialog()?.nativeElement.showModal();
  }

  protected closeFormDialog(): void {
    this.formDialog()?.nativeElement.close();
  }

  /** Fires on any dialog close — Cancel, Esc, or the imperative close() below — so form state
   * resets however the dialog was dismissed, not just the one path closeFormDialog() covers. */
  protected onDialogClose(): void {
    this.formMode.set(null);
  }

  protected async submitForm(): Promise<void> {
    const row = this.row();
    const mode = this.formMode();
    const amount = this.formAmount();
    if (!row || !mode || amount === null || amount < 0) {
      return;
    }
    const rollOver = row.categoryType === 'income' ? false : this.formRollOver();

    if (mode === 'edit') {
      await this.store.updateBudget(row.id, amount, rollOver);
      if (!this.store.error()) {
        this.closeFormDialog();
      }
      return;
    }

    // Creating the real budget replaces this implied row's synthetic id with a new real one
    // (issue #15's "reverts to edit/delete on a later visit") — this screen's `id` input would
    // otherwise point at an id that no longer resolves to any row, so navigate back to the list
    // rather than leave the user on a stale "Budget not found" detail screen.
    await this.store.addBudget(row.categoryId, amount, rollOver);
    if (!this.store.error()) {
      await this.router.navigate(['/budgets']);
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
