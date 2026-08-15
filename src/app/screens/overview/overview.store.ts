import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { DatabaseService } from '../../data/database.service';
import type { Account, Transaction } from '../../data/models';
import { SimplefinSyncService } from '../../simplefin/simplefin-sync.service';
import { filterUncategorized, netChangeInMonth } from '../transactions/transaction-grouping.util';
import { currentYearMonth } from '../../budgets/period.util';

/**
 * Screen-scoped store for the Overview tab: loads accounts/transactions from RxDB and
 * re-reads them after a background sync, following this codebase's plain-signals-
 * refreshed-imperatively convention (AccountsStore/TransactionsStore/BudgetsStore).
 */
@Injectable()
export class OverviewStore {
  private readonly databaseService = inject(DatabaseService);
  private readonly syncService = inject(SimplefinSyncService);

  readonly loading = signal(true);
  readonly accounts = signal<Account[]>([]);
  readonly transactions = signal<Transaction[]>([]);

  readonly totalBalance = computed(() => this.accounts().reduce((sum, a) => sum + a.balance, 0));

  readonly cashAccounts = computed(() => this.accounts().filter((a) => a.type === 'bank'));
  readonly creditAccounts = computed(() => this.accounts().filter((a) => a.type === 'creditCard'));

  readonly cashTotal = computed(() => this.cashAccounts().reduce((sum, a) => sum + a.balance, 0));
  readonly creditTotal = computed(() => this.creditAccounts().reduce((sum, a) => sum + a.balance, 0));

  /** Sourced from the access layer (spec §3) — surfaces as the Overview bell-icon badge. */
  readonly anyAccountNeedsAttention = computed(() =>
    this.accounts().some((a) => a.needsReconnect || a.syncIssue !== null || a.missing),
  );

  readonly balanceDeltaThisMonth = computed(() => netChangeInMonth(this.transactions(), currentYearMonth()));

  readonly uncategorizedTransactions = computed(() => filterUncategorized(this.transactions()));

  constructor() {
    effect(() => {
      if (!this.syncService.syncing()) {
        void this.refresh();
      }
    });
  }

  async refresh(): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const [accountDocs, transactionDocs] = await Promise.all([db.accounts.find().exec(), db.transactions.find().exec()]);
    this.accounts.set(accountDocs.map((doc) => doc.toJSON()));
    this.transactions.set(transactionDocs.map((doc) => doc.toJSON()));
    this.loading.set(false);
  }
}
