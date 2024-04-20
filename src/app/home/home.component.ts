import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { map, tap } from 'rxjs';
import { AppState } from '../app.module';
import { configuration } from '../data/state/selectors';
import { DBStateService } from '../data/database/dbState.service';
import { selectAccount } from '../data/state/actions';

@Component({
  template: `
  <app-home
    [configuration]="(configuration$|async)"
    [accounts]="(accounts$|async)||undefined"
    [transactions]="(transactions$|async)||undefined"
    [categories]="(categories$|async)||undefined"
    [budgets]="(budgets$|async)||undefined"
  ></app-home>
  `
})
export class HomeComponent {
  configuration$ = this.store.select(configuration);
  budgets$ = this.dbState.budgets$;
  categories$ = this.dbState.categories$;
  accounts$ = this.dbState.accounts$
  transactions$ = this.dbState.transactions$.pipe(
    map(a => [...a].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())),
  );

  constructor(private store: Store<AppState>, private dbState: DBStateService) { }

  ngOnInit(): void {
    this.store.dispatch(selectAccount(undefined));
  }

}
