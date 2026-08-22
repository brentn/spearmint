import { Injectable, inject } from '@angular/core';
import type { Transaction } from '../data/models';
import { DatabaseService } from '../data/database.service';
import { CategorizationRulesService } from '../categorization/categorization-rules.service';
import { CategorizationSuggestionsService } from '../categorization/categorization-suggestions.service';

/**
 * Classifies and inserts new (not-yet-persisted) transactions. Shared across every
 * transaction-ingestion path — SimpleFIN sync today, Statement Import next — so the
 * auto-categorization heuristic is applied consistently regardless of source.
 */
@Injectable({ providedIn: 'root' })
export class TransactionIngestionService {
  private readonly databaseService = inject(DatabaseService);
  private readonly categorizationRulesService = inject(CategorizationRulesService);
  private readonly suggestionsService = inject(CategorizationSuggestionsService);

  /** Applies the three-tier outcome (spec §3.1) to a batch of not-yet-persisted drafts for one
   * account, fetching that account's CategorizationRules once, then bulk-inserts the result:
   * auto-apply tier sets categoryId directly; the suggestion tier is recorded separately
   * (session-scoped, not part of the RxDB write) rather than mutating categoryId. */
  async categorizeAndInsert(accountId: string, drafts: Transaction[]): Promise<void> {
    if (drafts.length === 0) {
      return;
    }
    const db = await this.databaseService.getDatabase();
    const outcomes = await this.categorizationRulesService.classifyMany(accountId, drafts);
    const finalDrafts = drafts.map((draft) => {
      const outcome = outcomes.get(draft.id);
      if (!outcome) {
        return draft;
      }
      if (outcome.tier === 'auto') {
        return { ...draft, categoryId: outcome.categoryId };
      }
      if (outcome.tier === 'suggest' && outcome.categoryId) {
        this.suggestionsService.set(draft.id, outcome.categoryId);
      }
      return draft;
    });
    await db.transactions.bulkInsert(finalDrafts);
  }
}
