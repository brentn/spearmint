import { Injectable, effect, inject, signal } from '@angular/core';
import { CategoriesService } from '../../categories/categories.service';
import { CategorizationRulesService } from '../../categorization/categorization-rules.service';
import { CategorizationSuggestionsService } from '../../categorization/categorization-suggestions.service';
import { DatabaseService } from '../../data/database.service';
import type { Account, Category, Transaction } from '../../data/models';
import { SimplefinSyncService } from '../../simplefin/simplefin-sync.service';
import { TransactionMutationService } from '../../transactions/transaction-mutation.service';

/**
 * Screen-scoped store for the Transaction list: loads transactions/categories from RxDB
 * and re-reads them after every mutating action, matching this codebase's existing
 * convention (AccountsStore) of plain signals refreshed imperatively. Also re-reads
 * whenever a background sync (e.g. app-open auto-sync) finishes, so opening this screen
 * while a sync is still in flight doesn't leave it stuck showing a stale/empty snapshot.
 */
@Injectable()
export class TransactionsStore {
  private readonly databaseService = inject(DatabaseService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly syncService = inject(SimplefinSyncService);
  private readonly categorizationRulesService = inject(CategorizationRulesService);
  private readonly suggestionsService = inject(CategorizationSuggestionsService);
  private readonly mutationService = inject(TransactionMutationService);

  readonly loading = signal(true);
  readonly transactions = signal<Transaction[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly accounts = signal<Account[]>([]);

  constructor() {
    effect(() => {
      if (!this.syncService.syncing()) {
        void this.refresh();
      }
    });
  }

  async refresh(): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const [transactionDocs, categories, accountDocs] = await Promise.all([
      db.transactions.find().exec(),
      this.categoriesService.list(),
      db.accounts.find().exec(),
    ]);
    this.transactions.set(transactionDocs.map((doc) => doc.toJSON()));
    this.categories.set(categories);
    this.accounts.set(accountDocs.map((doc) => doc.toJSON()));
    this.loading.set(false);
    await this.refreshSuggestions();
  }

  /** Suggestions live only in CategorizationSuggestionsService's in-memory signal (spec §3.1's
   * dismissible tier isn't part of the locked Transaction shape in data/models.ts), so a
   * suggestion offered before a reload would otherwise vanish for good — the transaction is
   * "already-known" by then, and a later sync never re-categorizes it (acceptance criterion:
   * manual corrections are never clobbered). Recomputing here is read-only display state, not a
   * re-categorization: it never writes `categoryId`, so that guarantee still holds. */
  private async refreshSuggestions(): Promise<void> {
    const candidates = this.transactions().filter(
      (t) => !t.pending && !t.categoryId && this.suggestionsService.get(t.id) === null,
    );
    if (candidates.length === 0) {
      return;
    }
    const byAccount = new Map<string, Transaction[]>();
    for (const transaction of candidates) {
      const list = byAccount.get(transaction.accountId) ?? [];
      list.push(transaction);
      byAccount.set(transaction.accountId, list);
    }
    for (const [accountId, transactions] of byAccount) {
      const outcomes = await this.categorizationRulesService.classifyMany(accountId, transactions);
      for (const transaction of transactions) {
        const outcome = outcomes.get(transaction.id);
        if (outcome?.tier === 'suggest' && outcome.categoryId) {
          this.suggestionsService.set(transaction.id, outcome.categoryId);
        }
      }
    }
  }

  categoryName(categoryId: string | null): string {
    if (!categoryId) {
      return 'Uncategorized';
    }
    return this.categories().find((c) => c.id === categoryId)?.name ?? 'Uncategorized';
  }

  accountName(accountId: string): string {
    return this.accounts().find((a) => a.id === accountId)?.name ?? '';
  }

  /** Delegates to TransactionMutationService (issue #19) — pending-lock, RxDB patch, correction
   * recording and suggestion dismissal all live there now, shared with BudgetsStore. */
  async assignCategory(transactionId: string, categoryId: string | null): Promise<void> {
    await this.mutationService.assignCategory(transactionId, categoryId);
    await this.refresh();
  }

  async setNotes(transactionId: string, notes: string | null): Promise<void> {
    await this.mutationService.setNotes(transactionId, notes);
    await this.refresh();
  }

  async setExcludeFromBudget(transactionId: string, excludeFromBudget: boolean): Promise<void> {
    await this.mutationService.setExcludeFromBudget(transactionId, excludeFromBudget);
    await this.refresh();
  }

  /** The dismissible one-tap suggestion tier (spec §3.1) for a transaction, or null if none. */
  suggestionFor(transactionId: string): { categoryId: string; categoryName: string } | null {
    const categoryId = this.suggestionsService.get(transactionId);
    if (!categoryId) {
      return null;
    }
    return { categoryId, categoryName: this.categoryName(categoryId) };
  }

  async acceptSuggestion(transactionId: string): Promise<void> {
    const categoryId = this.suggestionsService.get(transactionId);
    if (!categoryId) {
      return;
    }
    await this.assignCategory(transactionId, categoryId);
  }

  dismissSuggestion(transactionId: string): void {
    this.suggestionsService.dismiss(transactionId);
  }
}
