import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { accounts, budgets, categories, configuration, transactions } from '../state/selectors';
import { map, of, tap } from 'rxjs';
import { AppState } from '../app.module';

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
    this.budgets$ = of([
      { categoryId: undefined, amount: 2000 },
      { categoryId: 12, amount: 1000 }
    ]);
  }

}
