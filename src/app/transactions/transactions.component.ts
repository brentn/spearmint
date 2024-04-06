import { Component } from '@angular/core';
import { DBStateService } from '../data/database/dbState.service';



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
  transactions$ = this.dbState.transactions$;
  categories$ = this.dbState.categories$;
  accounts$ = this.dbState.accounts$;

  constructor(private dbState: DBStateService) { }

  ngOnInit(): void { }

}
