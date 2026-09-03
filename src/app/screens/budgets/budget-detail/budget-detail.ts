import { DecimalPipe } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faPencil, faPlus } from '@fortawesome/free-solid-svg-icons';
import { type BudgetRowViewModel, BudgetsStore } from '../../../budgets/budgets.store';
import { isYearMonth } from '../../../budgets/period.util';
import type { Transaction } from '../../../data/models';
import { TransactionsStore } from '../../transactions/transactions.store';
import { TransactionEditDialog, type TransactionEditSave } from '../../../transactions/transaction-edit-dialog/transaction-edit-dialog';

@Component({
  selector: 'app-budget-detail',
  imports: [RouterLink, DecimalPipe, FaIconComponent, TransactionEditDialog],
  templateUrl: './budget-detail.html',
  styleUrl: './budget-detail.scss',
  providers: [BudgetsStore, TransactionsStore],
})
export class BudgetDetail {
  readonly id = input.required<string>();
  /** Optional ?period= query param carried from the Budgets list's own row link (issue #23
   * follow-up) — a category clicked while browsing a past month opens on that same month
   * instead of always defaulting to the current one. Ignored if absent or malformed. */
  readonly period = input<string>();

  protected readonly store = inject(BudgetsStore);
  // Screen-scoped instance used only for its assignCategory/setNotes/setExcludeFromBudget
  // delegate methods (issue #19) — same DI pattern as the Transactions screen. Its own read side
  // is unused here; BudgetsStore.refresh() is what the category-detail view actually reads from.
  private readonly transactionsStore = inject(TransactionsStore);
  private readonly router = inject(Router);
  protected readonly icons = { edit: faPencil, add: faPlus };

  protected readonly row = computed<BudgetRowViewModel | undefined>(() =>
    this.store.rows().find((row) => row.id === this.id()),
  );

  /** Hero label naming both the metric and the viewed month — "Spent this month"/"Spent in July
   * 2026" for expense/transfer, "Target vs. actual this month"/"...in July 2026" for income
   * (issue #23 follow-up: browsing a past month must be visible on income rows too, not just
   * expense ones). */
  protected readonly categoryLabel = computed(() => {
    const kind = this.row()?.categoryType === 'income' ? 'Target vs. actual' : 'Spent';
    return `${kind} ${this.store.monthPhrase()}`;
  });

  constructor() {
    // Seeds the store's period from the incoming query param (see `period` above), so this
    // screen opens on whichever month it was linked from rather than always the current one.
    effect(() => {
      const incoming = this.period();
      if (incoming && isYearMonth(incoming)) {
        this.store.period.set(incoming);
      }
    });
  }

  /** Transactions across this category and all of its descendants, the viewed period only — for
   * a leaf category (no children) this is just its own transactions, same as before issue #15. */
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
  /** The manual rollover override, if any — null means "keep it calculated automatically."
   * Once a value is saved here it's sticky (see BudgetsService.setForPeriod): there's no UI path
   * back to automatic for a period that's already been manually set. */
  protected readonly formRolloverAmount = signal<number | null>(null);

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
    this.formRolloverAmount.set(row.rolloverManual ? row.rolloverAmount : null);
    this.formMode.set('edit');
    this.formDialog()?.nativeElement.showModal();
  }

  protected openAddDialog(): void {
    this.formAmount.set(null);
    this.formRollOver.set(false);
    this.formRolloverAmount.set(null);
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
    const rolloverAmount = rollOver ? (this.formRolloverAmount() ?? undefined) : undefined;

    if (mode === 'edit') {
      await this.store.setBudget(row.categoryId, amount, rollOver, rolloverAmount);
      if (!this.store.error()) {
        this.closeFormDialog();
      }
      return;
    }

    // Creating the real budget replaces this implied row's synthetic id with a new real one
    // (issue #15's "reverts to edit/delete on a later visit") — this screen's `id` input would
    // otherwise point at an id that no longer resolves to any row, so navigate back to the list
    // rather than leave the user on a stale "Budget not found" detail screen.
    await this.store.setBudget(row.categoryId, amount, rollOver, rolloverAmount);
    if (!this.store.error()) {
      await this.router.navigate(['/budgets'], { queryParams: this.store.linkQueryParams() });
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

  /** Which transaction's edit dialog is open, if any — the dialog itself holds no such state. */
  protected readonly editingTransaction = signal<Transaction | null>(null);

  protected openTransactionDialog(transaction: Transaction): void {
    this.editingTransaction.set(transaction);
  }

  protected closeTransactionDialog(): void {
    this.editingTransaction.set(null);
  }

  /** Recategorizing out of the currently-viewed category just drops the row from
   * categoryTransactions() once BudgetsStore.refresh() re-reads — no special handling. */
  protected async saveTransactionEdit(transactionId: string, changes: TransactionEditSave): Promise<void> {
    await this.transactionsStore.assignCategory(transactionId, changes.categoryId);
    await this.transactionsStore.setNotes(transactionId, changes.notes);
    await this.transactionsStore.setExcludeFromBudget(transactionId, changes.excludeFromBudget);
    await this.store.refresh();
    this.editingTransaction.set(null);
  }
}
