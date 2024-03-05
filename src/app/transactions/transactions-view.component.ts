import { Component, Input, SimpleChanges } from '@angular/core';
import { Transaction } from '../state/types/transaction.type';
import { Category } from '../state/types/category.type';
import { Account } from '../state/types/account.type';

@Component({
  selector: 'transactions-view',
  templateUrl: './transactions-view.component.html',
  styleUrls: ['./transactions-view.component.css']
})
export class TransactionsViewComponent {
  @Input() transactions!: Transaction[];
  @Input() categories!: Category[];
  @Input() accounts!: Account[];
  uncategorizedTransactions: Transaction[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['transactions']) {
      this.uncategorizedTransactions = this.transactions.filter(transaction => transaction.categoryId === undefined);
    }
  }

}
