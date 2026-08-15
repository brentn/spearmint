import { DecimalPipe } from '@angular/common';
import { Component, HostListener, effect, input, output, signal } from '@angular/core';
import { CategoryPicker } from '../../categories/category-picker/category-picker';
import type { Category, Transaction } from '../../data/models';

export interface TransactionEditSave {
  categoryId: string | null;
  notes: string | null;
  excludeFromBudget: boolean;
}

/**
 * Presentational-only shared detail/edit surface for a single transaction (issue #19), opened
 * from both the Transactions screen and budget-detail's transaction list. Holds its own local
 * draft state for the three editable fields and only emits `save` on an explicit Save — no
 * per-field autosave like CategoryPicker's single-tap select, since free-text notes autosaving on
 * every keystroke would be unrequested chattiness against RxDB. Centered modal with a dimmed
 * backdrop, visually distinct from CategoryPicker's anchored popover.
 */
@Component({
  selector: 'app-transaction-edit-dialog',
  imports: [DecimalPipe, CategoryPicker],
  templateUrl: './transaction-edit-dialog.html',
  styleUrl: './transaction-edit-dialog.scss',
})
export class TransactionEditDialog {
  readonly transaction = input.required<Transaction>();
  readonly categories = input.required<Category[]>();
  readonly accountName = input.required<string>();

  readonly save = output<TransactionEditSave>();
  readonly close = output<void>();

  protected readonly draftCategoryId = signal<string | null>(null);
  protected readonly draftNotes = signal('');
  protected readonly draftExcludeFromBudget = signal(false);

  constructor() {
    // Reseeds the draft whenever a different transaction opens — "which transaction is open"
    // lives on the host screen, not here, so this just tracks the in-progress edit for it.
    effect(() => {
      const transaction = this.transaction();
      this.draftCategoryId.set(transaction.categoryId);
      this.draftNotes.set(transaction.notes ?? '');
      this.draftExcludeFromBudget.set(transaction.excludeFromBudget);
    });
  }

  protected onSave(): void {
    if (this.transaction().pending) {
      return;
    }
    const notes = this.draftNotes();
    this.save.emit({
      categoryId: this.draftCategoryId(),
      notes: notes.trim() === '' ? null : notes,
      excludeFromBudget: this.draftExcludeFromBudget(),
    });
  }

  protected onCancel(): void {
    this.close.emit();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close.emit();
  }
}
