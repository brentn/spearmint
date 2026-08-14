import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { Category } from '../../data/models';
import { todayDateOnlyUtc } from '../../simplefin/date-only.util';
import { countInMonth, groupTransactionsByDay, totalSpentInMonth } from './transaction-grouping.util';
import { TransactionsStore } from './transactions.store';

interface CategoryOptionGroup {
  label: string;
  options: Category[];
}

@Component({
  selector: 'app-transactions',
  imports: [DecimalPipe],
  templateUrl: './transactions.html',
  styleUrl: './transactions.scss',
  providers: [TransactionsStore],
})
export class Transactions {
  protected readonly store = inject(TransactionsStore);

  private readonly today = todayDateOnlyUtc();
  private readonly currentYearMonth = this.today.slice(0, 7);

  protected readonly totalSpentThisMonth = computed(() =>
    totalSpentInMonth(this.store.transactions(), this.currentYearMonth),
  );
  protected readonly transactionCountThisMonth = computed(() =>
    countInMonth(this.store.transactions(), this.currentYearMonth),
  );
  protected readonly dayGroups = computed(() => groupTransactionsByDay(this.store.transactions(), this.today));

  protected readonly categoryGroups = computed<CategoryOptionGroup[]>(() => {
    const categories = this.store.categories();
    const topLevels = categories.filter((c) => c.parentCategoryId === null);
    return topLevels.map((top) => {
      const children = categories.filter((c) => c.parentCategoryId === top.id);
      return { label: top.name, options: children.length > 0 ? children : [top] };
    });
  });

  async assignCategory(transactionId: string, input: EventTarget | null): Promise<void> {
    const value = (input as HTMLSelectElement | null)?.value;
    if (value === undefined) {
      return;
    }
    await this.store.assignCategory(transactionId, value === '' ? null : value);
  }
}
