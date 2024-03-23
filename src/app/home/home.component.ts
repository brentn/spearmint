import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { map, of } from 'rxjs';
import { AppState } from '../app.module';
import { configuration, budgets, accounts, categories, transactions } from '../data/state/selectors';

@Component({
  template: `
  <app-home
    [configuration]="(configuration$|async)"
    [accounts]="(accounts$|async)"
    [transactions]="(transactions$|async)"
    [categories]="(categories$|async)"
    [budgets]="(budgets$|async)"
  ></app-home>
  `
})
export class HomeComponent {
  configuration$ = this.store.select(configuration);
  budgets$ = this.store.select(budgets);
  accounts$ = this.store.select(accounts);
  categories$ = this.store.select(categories);
  transactions$ = this.store.select(transactions).pipe(
    map(a => [...a].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())),
  );

  constructor(private store: Store<AppState>) { }

  ngOnInit(): void {
  }

}
