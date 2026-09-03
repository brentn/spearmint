import { Injectable, inject } from '@angular/core';
import { CategorizationRulesService } from '../categorization/categorization-rules.service';
import { CategorizationSuggestionsService } from '../categorization/categorization-suggestions.service';
import { DatabaseService } from '../data/database.service';

/** The three fields the transaction-edit dialog can change in one save. */
export interface TransactionEditFields {
  categoryId: string | null;
  notes: string | null;
  excludeFromBudget: boolean;
}

/**
 * Writes only — owns every mutation to a Transaction's editable fields (categoryId, notes,
 * excludeFromBudget). Shared by TransactionsStore and BudgetsStore (issue #19) so a category
 * correction is recorded consistently regardless of which screen made it. Deliberately has no
 * read/refresh side of its own: both stores keep their own independent transaction reads.
 */
@Injectable({ providedIn: 'root' })
export class TransactionMutationService {
  private readonly databaseService = inject(DatabaseService);
  private readonly categorizationRulesService = inject(CategorizationRulesService);
  private readonly suggestionsService = inject(CategorizationSuggestionsService);

  /** Pending transactions are wiped and replaced every sync — locked from manual editing.
   * Assigning a real category also records/updates a CategorizationRule from this correction so
   * future matching transactions benefit. */
  async assignCategory(transactionId: string, categoryId: string | null): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const doc = await db.transactions.findOne(transactionId).exec();
    if (!doc || doc.pending) {
      return;
    }
    const transaction = doc.toJSON();
    await doc.incrementalPatch({ categoryId });
    if (categoryId) {
      await this.categorizationRulesService.recordCorrection(
        {
          id: transaction.id,
          accountId: transaction.accountId,
          description: transaction.description,
          amount: transaction.amount,
          date: transaction.date,
        },
        categoryId,
      );
    }
    this.suggestionsService.dismiss(transactionId);
  }

  /** The transaction-edit dialog's Save button — one patch for all three editable fields. Unlike
   * `assignCategory` (an explicit, deliberate correction), a rule is only recorded here if
   * `categoryId` actually changed, so saving an unrelated notes/exclude edit doesn't silently
   * refresh an untouched category's rule. `dismiss()` still runs unconditionally: saving this
   * dialog at all means the user reviewed the transaction, which is reason enough to clear any
   * pending suggestion for it, notes-only edit or not. */
  async saveEdit(transactionId: string, changes: TransactionEditFields): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const doc = await db.transactions.findOne(transactionId).exec();
    if (!doc || doc.pending) {
      return;
    }
    const transaction = doc.toJSON();
    const categoryChanged = changes.categoryId !== transaction.categoryId;
    await doc.incrementalPatch(changes);
    if (categoryChanged && changes.categoryId) {
      await this.categorizationRulesService.recordCorrection(
        {
          id: transaction.id,
          accountId: transaction.accountId,
          description: transaction.description,
          amount: transaction.amount,
          date: transaction.date,
        },
        changes.categoryId,
      );
    }
    this.suggestionsService.dismiss(transactionId);
  }
}
