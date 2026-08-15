import { Injectable, inject } from '@angular/core';
import { CategorizationRulesService } from '../categorization/categorization-rules.service';
import { CategorizationSuggestionsService } from '../categorization/categorization-suggestions.service';
import { DatabaseService } from '../data/database.service';

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

  async setNotes(transactionId: string, notes: string | null): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const doc = await db.transactions.findOne(transactionId).exec();
    if (!doc || doc.pending) {
      return;
    }
    await doc.incrementalPatch({ notes });
  }

  async setExcludeFromBudget(transactionId: string, excludeFromBudget: boolean): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const doc = await db.transactions.findOne(transactionId).exec();
    if (!doc || doc.pending) {
      return;
    }
    await doc.incrementalPatch({ excludeFromBudget });
  }
}
