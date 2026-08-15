import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { todayDateOnlyUtc } from '../../simplefin/date-only.util';
import {
  countInMonth,
  filterByAccount,
  filterUncategorized,
  groupTransactionsByDay,
  totalSpentInMonth,
} from './transaction-grouping.util';
import { TransactionsStore } from './transactions.store';
import { CategoryPicker } from '../../categories/category-picker/category-picker';

@Component({
  selector: 'app-transactions',
  imports: [DecimalPipe, CategoryPicker, RouterLink],
  templateUrl: './transactions.html',
  styleUrl: './transactions.scss',
  providers: [TransactionsStore],
})
export class Transactions {
  protected readonly store = inject(TransactionsStore);
  private readonly route = inject(ActivatedRoute);

  private readonly today = todayDateOnlyUtc();
  private readonly currentYearMonth = this.today.slice(0, 7);

  /** ActivatedRoute's observables are router-lifecycle-managed — no manual unsubscribe needed. */
  protected readonly filteredToUncategorized = signal(false);
  protected readonly filteredAccountId = signal<string | null>(null);

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      this.filteredToUncategorized.set(params.get('filter') === 'uncategorized');
      this.filteredAccountId.set(params.get('accountId'));
    });
  }

  /** Respects the active filter (uncategorized or a single account) so the hero stats match the
   * list below it. The two filters are mutually exclusive — set via independent query params
   * that Angular's default navigation replaces wholesale. */
  private readonly visibleTransactions = computed(() => {
    if (this.filteredToUncategorized()) {
      return filterUncategorized(this.store.transactions());
    }
    const accountId = this.filteredAccountId();
    return accountId ? filterByAccount(this.store.transactions(), accountId) : this.store.transactions();
  });

  /** Label for the filter badge — reused for both the uncategorized and account-drill-in filters. */
  protected readonly filterBadgeLabel = computed(() => {
    if (this.filteredToUncategorized()) {
      return 'Uncategorized';
    }
    const accountId = this.filteredAccountId();
    // Falls back to a placeholder rather than accountName()'s '' so the badge (the only way
    // to clear the filter) stays visible even if accounts haven't loaded yet.
    return accountId ? this.store.accountName(accountId) || 'Account' : null;
  });

  protected readonly totalSpentThisMonth = computed(() =>
    totalSpentInMonth(this.visibleTransactions(), this.currentYearMonth),
  );
  protected readonly transactionCountThisMonth = computed(() =>
    countInMonth(this.visibleTransactions(), this.currentYearMonth),
  );
  protected readonly dayGroups = computed(() => groupTransactionsByDay(this.visibleTransactions(), this.today));

  async assignCategory(transactionId: string, categoryId: string | null): Promise<void> {
    await this.store.assignCategory(transactionId, categoryId);
  }

  async acceptSuggestion(transactionId: string): Promise<void> {
    await this.store.acceptSuggestion(transactionId);
  }

  dismissSuggestion(transactionId: string): void {
    this.store.dismissSuggestion(transactionId);
  }
}
