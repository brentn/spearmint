import { Component, Input, SimpleChanges } from '@angular/core';
import { Category } from '../data/types/category.type';
import { Account } from '../data/models/account';
import { Transaction } from '../data/models/transaction';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { AppState } from '../app.module';
import { selectBudget } from '../data/state/actions';

@Component({
  selector: 'transactions-view',
  templateUrl: './transactions-view.component.html',
  styleUrls: ['./transactions-view.component.css']
})
export class TransactionsViewComponent {
  @Input() transactions: Transaction[] | undefined;
  @Input() categories: Category[] | undefined = undefined;
  @Input() accounts: Account[] | undefined = undefined;
  @Input() title: string = '';

  uncategorizedTransactions: Transaction[] = [];
  backIcon = faArrowLeft;

  constructor(private store: Store<AppState>, private router: Router) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['transactions']) {
      this.uncategorizedTransactions = (this.transactions || []).filter(transaction => transaction.categoryId === undefined);
    }
  }

  onBack(): void {
    switch (this.router.url) {
      case '/budgets': this.store.dispatch(selectBudget(undefined)); break;
      default: this.router.navigate(['/']); break;
    }
  }


}
