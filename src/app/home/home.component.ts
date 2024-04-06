import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { map, tap } from 'rxjs';
import { AppState } from '../app.module';
import { configuration } from '../data/state/selectors';
import { DBStateService } from '../data/database/dbState.service';

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
  budgets$ = this.dbState.budgets$;
  categories$ = this.dbState.categories$;
  accounts$ = this.dbState.accounts$
  transactions$ = this.dbState.transactions$.pipe(
    map(a => [...a].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())),
  );

  constructor(private store: Store<AppState>, private dbState: DBStateService) { }

  ngOnInit(): void { }

}
