import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { todayDateOnlyUtc } from '../../simplefin/date-only.util';
import {
  countInMonth,
  filterByAccount,
  filterBySearch,
  filterUncategorized,
  groupTransactionsByDay,
  totalSpentInMonth,
} from './transaction-grouping.util';
import { TransactionsStore } from './transactions.store';
import { CategoryPicker } from '../../categories/category-picker/category-picker';
import { TransactionEditDialog, type TransactionEditSave } from '../../transactions/transaction-edit-dialog/transaction-edit-dialog';
import type { Transaction } from '../../data/models';

@Component({
  selector: 'app-transactions',
  imports: [DecimalPipe, CategoryPicker, RouterLink, TransactionEditDialog, FaIconComponent],
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
  protected readonly searchQuery = signal('');
  protected readonly icons = { search: faMagnifyingGlass };

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      this.filteredToUncategorized.set(params.get('filter') === 'uncategorized');
      this.filteredAccountId.set(params.get('accountId'));
    });
  }

  /** Whether there's anything at all to search — independent of the active filter/query, so the
   * search box itself doesn't disappear just because it produced zero results. */
  protected readonly hasAnyTransactions = computed(() => this.store.transactions().length > 0);

  /** Respects the active filter (uncategorized or a single account) so the hero stats match the
   * list below it. The two filters are mutually exclusive — set via independent query params
   * that Angular's default navigation replaces wholesale. The free-text search box narrows the
   * list further (see `visibleTransactions`) but deliberately isn't folded in here — searching
   * for one transaction shouldn't make the hero's month total/count look like that's all there is. */
  private readonly filteredTransactions = computed(() => {
    if (this.filteredToUncategorized()) {
      return filterUncategorized(this.store.transactions());
    }
    const accountId = this.filteredAccountId();
    return accountId ? filterByAccount(this.store.transactions(), accountId) : this.store.transactions();
  });

  /** `filteredTransactions` further narrowed by the search box — feeds the list only. */
  private readonly visibleTransactions = computed(() =>
    filterBySearch(this.filteredTransactions(), this.searchQuery(), this.store.categories(), this.today),
  );

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
    totalSpentInMonth(this.filteredTransactions(), this.currentYearMonth),
  );
  protected readonly transactionCountThisMonth = computed(() =>
    countInMonth(this.filteredTransactions(), this.currentYearMonth),
  );
  protected readonly dayGroups = computed(() => groupTransactionsByDay(this.visibleTransactions(), this.today));

  /** Which transaction's edit dialog is open, if any — the dialog itself holds no such state. */
  protected readonly editingTransaction = signal<Transaction | null>(null);

  async assignCategory(transactionId: string, categoryId: string | null): Promise<void> {
    await this.store.assignCategory(transactionId, categoryId);
  }

  async acceptSuggestion(transactionId: string): Promise<void> {
    await this.store.acceptSuggestion(transactionId);
  }

  protected openEditDialog(transaction: Transaction): void {
    this.editingTransaction.set(transaction);
  }

  protected closeEditDialog(): void {
    this.editingTransaction.set(null);
  }

  protected async saveEdit(transactionId: string, changes: TransactionEditSave): Promise<void> {
    await this.store.saveEdit(transactionId, changes);
    this.editingTransaction.set(null);
  }
}
