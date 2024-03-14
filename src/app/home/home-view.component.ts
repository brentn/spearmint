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
  @Input() accounts: Account[] | null = null;
  @Input() transactions: Transaction[] | null = null;
  @Input() categories: Category[] | null = null;
  @Input() budgets: Budget[] | null = null;

  accountTypes: AccountType[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['accounts']) {
      this.accountTypes = (this.accounts?.reduce((acc: AccountType[], account) => acc.includes(account.type) ? acc : acc.concat(account.type), []) ?? [])
        .sort((a, b) => a.localeCompare(b));
    }
  }

  get recentTransactions(): Transaction[] { return (this.transactions ?? []).slice(0, 5); }
  get uncategorizedTransactions(): Transaction[] | undefined {
    const transactions = this.transactions?.filter(a => a.categoryId === undefined).slice(0, 5);
    if ((transactions ?? [])?.length > 0) return transactions;
    else return undefined;
  }

  accountsOfType(accountType: AccountType): Account[] { return (this.accounts || [])?.filter(a => a.type === accountType); }

}


