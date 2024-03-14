import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from '../app.module';
import { accounts, categories, transactions } from '../data/state/selectors';



@Component({
  template: `
  <transactions-view
    [transactions]="(transactions$|async)!"
    [categories]="(categories$|async)!"
    [accounts]="(accounts$|async)!"
  ></transactions-view>
  `,
})
export class TransactionsComponent {
  transactions$ = this.store.select(transactions);
  categories$ = this.store.select(categories);
  accounts$ = this.store.select(accounts);

  constructor(private store: Store<AppState>) { }

  ngOnInit(): void {
    // [
    //   { id: '1', name: 'Out', balance: 3091.14, active: true, type: 'bank', institution: 'Envision Financial', lastUpdated: new Date() },
    //   { id: '3', name: 'Savings', balance: 1000.08, active: true, type: 'bank', institution: 'Envision Financial', lastUpdated: new Date() },
    //   { id: '2', name: 'MasterCard', balance: -1968.12, active: true, type: 'creditCard', institution: 'CIBC', lastUpdated: new Date() }
    // ].forEach(account => this.store.dispatch(addAccount(account as Account)));
    // this.store.dispatch(addTransactions([
    //   { id: '1', categoryId: undefined, date: new Date(2024, 1, 1), merchant: 'purchase at A&W', amount: 43.19, accountId: '2' },
    //   { id: '2', categoryId: undefined, date: new Date(2024, 2, 3), merchant: 'donation to SIM', amount: 400, accountId: '1' },
    //   { id: '3', categoryId: undefined, date: new Date(2024, 2, 1), merchant: 'Dollar Smart!', amount: 5.13, accountId: '2' },
    //   { id: '4', categoryId: undefined, date: new Date(2024, 3, 14), merchant: 'Starbucks', amount: 55.90, accountId: '2' },
    //   { id: '5', categoryId: undefined, date: new Date(2024, 3, 11), merchant: 'Dollar Smart!', amount: 117.10, accountId: '2' },
    //   { id: '6', categoryId: undefined, date: new Date(2024, 2, 21), merchant: 'HBC Alone', amount: 393.44, accountId: '2' },
    //   { id: '7', categoryId: 12, date: new Date(2024, 2, 21), merchant: 'Wages', amount: 800.44, accountId: '1' },
    // ]));

  }

}
