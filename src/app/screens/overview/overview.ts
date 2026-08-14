import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';
import { BudgetRow } from '../../budgets/budget-row/budget-row';
import { type BudgetRowViewModel, BudgetsStore } from '../../budgets/budgets.store';
import type { AccountType } from '../../data/models';
import { OverviewStore } from './overview.store';

type AccountFilter = 'all' | AccountType;

interface AccountTotalCard {
  key: AccountType;
  label: string;
  value: number;
}

const BUDGETS_TO_WATCH_LIMIT = 3;

@Component({
  selector: 'app-overview',
  imports: [RouterLink, FaIconComponent, DecimalPipe, BudgetRow],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
  providers: [OverviewStore, BudgetsStore],
})
export class Overview {
  protected readonly store = inject(OverviewStore);
  protected readonly budgetsStore = inject(BudgetsStore);
  protected readonly icons = { bell: faBell };

  protected readonly accountFilter = signal<AccountFilter>('all');

  protected readonly accountCards = computed<AccountTotalCard[]>(() => {
    const filter = this.accountFilter();
    const cards: AccountTotalCard[] = [
      { key: 'bank', label: 'Cash', value: this.store.cashTotal() },
      { key: 'creditCard', label: 'Credit cards', value: this.store.creditTotal() },
    ];
    return cards.filter((c) => filter === 'all' || filter === c.key);
  });

  /** Highest-percent-used budgets first — the ones most worth a glance from the home screen. */
  protected readonly budgetsToWatch = computed<BudgetRowViewModel[]>(() =>
    [...this.budgetsStore.rows()].sort((a, b) => b.percent - a.percent).slice(0, BUDGETS_TO_WATCH_LIMIT),
  );
}
