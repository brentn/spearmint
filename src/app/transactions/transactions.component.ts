import { Component } from '@angular/core';
import { DBStateService } from '../data/database/dbState.service';
import { AppState } from '../app.module';
import { Store } from '@ngrx/store';
import { map, zip } from 'rxjs';
import { selectedAccount } from '../data/state/selectors';



@Component({
  template: `
  <transactions-view
    [transactions]="(transactions$|async)!"
    [categories]="(categories$|async)!"
    [accounts]="(accounts$|async)!"
    [selectedAccount]="(selectedAccount$|async)||undefined">
  ></transactions-view>
  `,
})
export class TransactionsComponent {
  transactions$ = zip(this.dbState.transactions$, this.store.select(selectedAccount)).pipe(
    map(([transactions, account]) => transactions.filter(a => !account || (a.accountId === account.id))),
  );
  categories$ = this.dbState.categories$;
  accounts$ = this.dbState.accounts$;
  selectedAccount$ = this.store.select(selectedAccount);

  constructor(private store: Store<AppState>, private dbState: DBStateService) { }

  ngOnInit(): void { }

}


