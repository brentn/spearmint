import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { todayDateOnlyUtc } from '../../simplefin/date-only.util';
import { countInMonth, filterUncategorized, groupTransactionsByDay, totalSpentInMonth } from './transaction-grouping.util';
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

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      this.filteredToUncategorized.set(params.get('filter') === 'uncategorized');
    });
  }

  /** Respects the uncategorized filter so the hero stats match the list below it. */
  private readonly visibleTransactions = computed(() =>
    this.filteredToUncategorized() ? filterUncategorized(this.store.transactions()) : this.store.transactions(),
  );

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
}
