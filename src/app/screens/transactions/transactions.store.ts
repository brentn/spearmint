import { Injectable, effect, inject, signal } from '@angular/core';
import { CategoriesService } from '../../categories/categories.service';
import { DatabaseService } from '../../data/database.service';
import type { Account, Category, Transaction } from '../../data/models';
import { SimplefinSyncService } from '../../simplefin/simplefin-sync.service';

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

  /** Pending transactions are wiped and replaced every sync (spec §1/§3) — locked from manual editing. */
  async assignCategory(transactionId: string, categoryId: string | null): Promise<void> {
    const transaction = this.transactions().find((t) => t.id === transactionId);
    if (!transaction || transaction.pending) {
      return;
    }
    const db = await this.databaseService.getDatabase();
    const doc = await db.transactions.findOne(transactionId).exec();
    await doc?.incrementalPatch({ categoryId });
    await this.refresh();
  }
}
