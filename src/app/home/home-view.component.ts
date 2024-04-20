import { Component, Input, SimpleChanges } from '@angular/core';
import { Configuration, DEFAULT_CONFIGURATION } from '../data/types/configuration.type';
import { AccountType } from '../data/types/accountType';
import { Category } from '../data/types/category.type';
import { Budget } from '../data/types/budget.type';
import { Account } from '../data/models/account';
import { Transaction } from '../data/models/transaction';

@Component({
  selector: 'app-home',
  templateUrl: './home-view.component.html',
  styleUrls: ['./home-view.component.css']
})
export class HomeViewComponent {
  @Input() configuration: Configuration | null = DEFAULT_CONFIGURATION;
  @Input() accounts: Account[] | undefined;
  @Input() transactions: Transaction[] | undefined;
  @Input() categories: Category[] | undefined;
  @Input() budgets: Budget[] | undefined;
  selectedTransaction: Transaction | undefined;

  ngOnChanges(changes: SimpleChanges): void {
  }

  get visibleAccounts(): Account[] { return this.accounts?.filter(a => a.active) || []; }
  get accountTypes(): AccountType[] {
    return (this.visibleAccounts ?? [])
      .reduce((acc: AccountType[], account) => acc.includes(account.type) ? acc : [...acc, account.type], [])
      .sort((a, b) => a.localeCompare(b));
  }
  get recentTransactions(): Transaction[] { return (this.transactions ?? []).slice(0, 5); }
  get uncategorizedTransactions(): Transaction[] | undefined {
    const transactions = this.transactions?.filter(a => a.categoryId === undefined).slice(0, 5);
    if ((transactions ?? [])?.length > 0) return transactions;
    else return undefined;
  }

  accountsOfType(accountType: AccountType): Account[] { return this.visibleAccounts.filter(a => a.type === accountType); }

  onSelect(item: Transaction | undefined): void {
    this.selectedTransaction = item;
  }

}


