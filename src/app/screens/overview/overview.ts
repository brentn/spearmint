import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faBell, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { BudgetRow } from '../../budgets/budget-row/budget-row';
import { type BudgetRowViewModel, BudgetsStore } from '../../budgets/budgets.store';
import { FlowProgress } from '../../budgets/flow-progress/flow-progress';
import type { Account, AccountType } from '../../data/models';
import { OverviewStore } from './overview.store';

type AccountFilter = 'all' | AccountType;

interface AccountTotalCard {
  key: AccountType;
  label: string;
  value: number;
  accounts: Account[];
}

const BUDGETS_TO_WATCH_LIMIT = 3;

@Component({
  selector: 'app-overview',
  imports: [RouterLink, FaIconComponent, DecimalPipe, BudgetRow, FlowProgress],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
  providers: [OverviewStore, BudgetsStore],
})
export class Overview {
  protected readonly store = inject(OverviewStore);
  protected readonly budgetsStore = inject(BudgetsStore);
  protected readonly icons = { bell: faBell, chevron: faChevronDown };

  protected readonly accountFilter = signal<AccountFilter>('all');
  protected readonly expandedCard = signal<AccountType | null>(null);

  protected readonly accountCards = computed<AccountTotalCard[]>(() => {
    const filter = this.accountFilter();
    const cards: AccountTotalCard[] = [
      { key: 'bank', label: 'Cash', value: this.store.cashTotal(), accounts: this.store.cashAccounts() },
      { key: 'creditCard', label: 'Credit cards', value: this.store.creditTotal(), accounts: this.store.creditAccounts() },
    ];
    return cards.filter((c) => filter === 'all' || filter === c.key);
  });

  protected toggleExpanded(key: AccountType): void {
    this.expandedCard.update((current) => (current === key ? null : key));
  }

  /** Highest-percent-used budgets first — the ones most worth a glance from the home screen. */
  protected readonly budgetsToWatch = computed<BudgetRowViewModel[]>(() =>
    [...this.budgetsStore.rows()].sort((a, b) => b.percent - a.percent).slice(0, BUDGETS_TO_WATCH_LIMIT),
  );

  protected readonly uncategorizedPreview = computed(() => this.store.uncategorizedTransactions().slice(0, 2));
}
