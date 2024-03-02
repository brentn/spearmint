import { Component, Input, SimpleChanges } from '@angular/core';
import { Account } from '../state/types/account.type';
import { Configuration, DEFAULT_CONFIGURATION } from '../state/types/configuration.type';
import { AccountType } from '../state/types/accountType.type';
import { Transaction } from '../state/types/transaction.type';
import { Category } from '../state/types/category.type';

@Component({
  selector: 'app-home',
  templateUrl: './home-view.component.html',
  styleUrls: ['./home-view.component.css']
})
export class HomeViewComponent {
  @Input() configuration: Configuration = DEFAULT_CONFIGURATION;
  @Input() accounts: Account[] = [];
  @Input() transactions: Transaction[] = [];
  @Input() categories: Category[] = [];

  accountTypes: AccountType[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['accounts']) {
      this.accountTypes = this.accounts.reduce((acc: AccountType[], account) => acc.includes(account.type) ? acc : acc.concat(account.type), [])
        .sort((a, b) => a.localeCompare(b));
    }
  }

  get recentTransactions(): Transaction[] { return this.transactions.slice(0, 5); }
  get uncategorizedTransactions(): Transaction[] | undefined {
    const transactions = this.transactions.filter(a => a.categoryId === undefined).slice(0, 5);
    if (transactions.length > 0) return transactions;
    else return undefined;
  }

  accountsOfType(accountType: AccountType): Account[] { return this.accounts.filter(a => a.type === accountType); }

}


