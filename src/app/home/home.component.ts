import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from '../state';
import { accounts, categories, configuration, transactions } from '../state/selectors';
import { map, of } from 'rxjs';

@Component({
  template: `
  <app-home
    [configuration]="(configuration$|async)!"
    [accounts]="(accounts$|async)!"
    [transactions]="(transactions$|async)!"
    [categories]="(categories$|async)!"
  ></app-home>
  `
})
export class HomeComponent {
  configuration$ = this.store.select(configuration);
  accounts$ = this.store.select(accounts);
  transactions$ = this.store.select(transactions).pipe(map(a => [...a].sort((a, b) => b.date.getTime() - a.date.getTime())));
  categories$ = this.store.select(categories);

  constructor(private store: Store<AppState>) { }

  ngOnInit(): void {
    this.accounts$ = of([
      { id: '1', name: 'Out', balance: 3091.14, active: true, type: 'bank', institution: 'Envision Financial', lastUpdated: new Date() },
      { id: '3', name: 'Savings', balance: 1000.08, active: true, type: 'bank', institution: 'Envision Financial', lastUpdated: new Date() },
      { id: '2', name: 'MasterCard', balance: -1968.12, active: true, type: 'creditCard', institution: 'CIBC', lastUpdated: new Date() }
    ]);
    this.transactions$ = of([
      { id: '1', categoryId: undefined, date: new Date(2024, 1, 1), description: 'purchase at A&W', amount: 43.19, accountId: '2' },
      { id: '2', categoryId: undefined, date: new Date(2024, 2, 3), description: 'donation to SIM', amount: 400, accountId: '1' },
      { id: '3', categoryId: undefined, date: new Date(2024, 2, 1), description: 'Dollar Smart!', amount: 5.13, accountId: '2' },
      { id: '4', categoryId: undefined, date: new Date(2024, 3, 14), description: 'Starbucks', amount: 55.90, accountId: '2' },
      { id: '5', categoryId: undefined, date: new Date(2024, 3, 11), description: 'Dollar Smart!', amount: 117.10, accountId: '2' },
      { id: '6', categoryId: undefined, date: new Date(2024, 2, 21), description: 'HBC Alone', amount: 393.44, accountId: '2' },
    ])
  }

}
