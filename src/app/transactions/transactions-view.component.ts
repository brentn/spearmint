import { Component, Input, SimpleChanges } from '@angular/core';
import { Category } from '../data/types/category.type';
import { Account } from '../data/models/account';
import { Transaction } from '../data/models/transaction';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { AppState } from '../app.module';
import { selectAccount, selectBudget } from '../data/state/actions';
import { FormControl, FormGroup } from '@angular/forms';

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
  selectedTransaction: Transaction | undefined;
  filteredTransactions: Transaction[] = [];
  backIcon = faArrowLeft;

  form = new FormGroup({
    search: new FormControl<string>(''),
  })

  constructor(private store: Store<AppState>, private router: Router) {
    this.form.valueChanges.subscribe(() => this.onFilter());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['transactions']) {
      this.uncategorizedTransactions = (this.transactions || []).filter(transaction => transaction.categoryId === undefined);
      this.onFilter();
    }
  }

  onFilter(): void {
    this.filteredTransactions = (this.transactions || []);
    this.form.value.search?.toLowerCase().split(' ').forEach(term => {
      this.filteredTransactions = this.filteredTransactions
        .filter(transaction => transaction.searchText.includes(term));
    });
  }

  onSelect(item: Transaction | undefined): void {
    this.selectedTransaction = item;
  }

  onBack(): void {
    switch (this.router.url) {
      case '/budgets': this.store.dispatch(selectBudget(undefined)); break;
      case '/': this.store.dispatch(selectAccount(undefined)); break;
      default: this.router.navigate(['/']); break;
    }
  }


}
