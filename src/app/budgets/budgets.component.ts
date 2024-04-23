import { Component } from '@angular/core';
import { DBStateService } from '../data/database/dbState.service';
import { Store } from '@ngrx/store';
import { AppState } from '../app.module';
import { selectedBudget } from '../data/state/selectors';
import { map } from 'rxjs';

@Component({
  template: `
  <app-budgets
    [budgets]="(budgets$|async)||undefined"
    [transactions]="(transactions$|async)||undefined"
    [accounts]="(accounts$|async)||undefined"
    [categories]="(categories$|async)||undefined"
    [selectedBudget]="(selectedBudget$|async)||undefined"
  ></app-budgets>
  `
})
export class BudgetsComponent {

  budgets$ = this.db.budgets$;
  transactions$ = this.db.transactions$.pipe(
    map(items => items.filter(a => !a.hideFromBudget))
  );
  accounts$ = this.db.accounts$;
  categories$ = this.db.categories$;
  selectedBudget$ = this.store.select(selectedBudget);

  constructor(private db: DBStateService, private store: Store<AppState>) { }
}
