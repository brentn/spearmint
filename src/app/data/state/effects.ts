import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { accountAdded, accountUpdated, addAccount, addTransactions, endLoad, getLatestTransactions, getLinkToken, initialize, loggedIn, refreshAccounts, reset, restoreState, saveState, setLinkToken, startLoad, stateRestored, transactionUpdated, transactionsAdded, updateAccount, updateTransaction } from "./actions";
import { concat, filter, map, of, switchMap, tap, withLatestFrom } from "rxjs";
import { Store } from "@ngrx/store";
import { AppState } from "src/app/app.module";
import { LocalStorageService } from "../database/local-storage.service";
import { DatabaseService } from "../database/database.service";
import { Account } from "../models/account";
import { DBStateService } from "./dbState.service";

const MIN_REFRESH_FREQUENCY = 120; //minutes

@Injectable()
export class MainEffects {

  constructor(
    private actions$: Actions,
    private store: Store<AppState>,
    private db: DatabaseService,
    private dbState: DBStateService,
    private persistence: LocalStorageService
  ) { }

  spinUpServer$ = createEffect(() => this.actions$.pipe(
    ofType(initialize),
    tap(() => this.db.spinUpServer$().subscribe())
  ), { dispatch: false });

  getLinkToken$ = createEffect(() => this.actions$.pipe(
    ofType(getLinkToken),
    switchMap(() => this.db.getLinkToken$().pipe(
      map(linkToken => setLinkToken(linkToken))
    ))
  ));

  addAccount$ = createEffect(() => this.actions$.pipe(
    ofType(addAccount),
    switchMap(action => this.dbState.Accounts.add$(action.payload)),
    map(account => accountAdded(account))
  ));

  updateAccount$ = createEffect(() => this.actions$.pipe(
    ofType(updateAccount),
    switchMap(action => this.dbState.Accounts.update$(action.payload)),
    map(account => accountUpdated(account))
  ));

  addTransactions$ = createEffect(() => this.actions$.pipe(
    ofType(addTransactions),
    switchMap(action => this.dbState.Transactions.addMany$(action.payload)),
    map(transactions => transactionsAdded(transactions))
  ));

  updateTransaction$ = createEffect(() => this.actions$.pipe(
    ofType(updateTransaction),
    switchMap(action => this.dbState.Transactions.update$(action.payload)),
    map(transaction => transactionUpdated(transaction))
  ));

  // removeTransaction$ = createEffect(() => this.actions$.pipe(
  //   ofType(removeTransaction),
  //   switchMap(action => this.dbState.Transactions.delete$(action.payload)),
  //   map(transaction => transactionRemoved(transaction))
  // ));

  reset$ = createEffect(() => this.actions$.pipe(
    ofType(reset),
    switchMap(() => this.dbState.Transactions.reset$()),
    switchMap(() => this.dbState.Accounts.reset$()),
  ), { dispatch: false });

  refreshAccounts$ = createEffect(() => this.actions$.pipe(
    ofType(initialize, refreshAccounts),
    switchMap(() => this.dbState.storeReady$),
    withLatestFrom(this.dbState.accounts$),
    switchMap(([_, accounts]) => concat(
      of(startLoad('refresh')),
      ...accounts
        .filter(account => ((Date.now() - (account.lastUpdated ?? 0)) > (MIN_REFRESH_FREQUENCY * 60 * 1000)))
        .filter(account => !!account.accessToken)
        .reduce((acc: Account[], item) => acc.find(a => a.accessToken === item.accessToken) ? acc : [...acc, item], [])
        .map(account => [getAccountBalances(account.accessToken), getLatestTransactions(account)]),
      of(endLoad('refresh'))
    ))
  ));

  // getAccountBalances$ = createEffect(() => this.actions$.pipe(
  //   ofType(getAccountBalances),
  //   withLatestFrom(this.store.select(accounts)),
  //   switchMap(([action, accounts]) => concat(
  //     of(startLoad('refreshBalances')),
  //     this.db.accountBalances$(action.payload).pipe(
  //       map(dto => {
  //         const result: Account[] = [];
  //         dto.forEach(item => {
  //           const account = accounts.find(a => a.id === item.account_id);
  //           if (account) result.push(new Account({
  //             ...account,
  //             balance: item.balances.current,
  //             lastUpdated: new Date().getTime(),
  //             failure: undefined
  //           }));
  //         });
  //         return result;
  //       }),
  //       switchMap(accounts => accounts.map(account => updateAccount(account))),
  //       finalize(() => { this.store.dispatch(endLoad('refreshBalances')) }),
  //       catchError(() => concat(accounts.filter(a => a.accessToken === action.payload).map(account => updateAccount(new Account({
  //         ...account,
  //         failure: true
  //       })))))
  //     )
  //   ))
  // ));

  // getLatestTransactions$ = createEffect(() => this.actions$.pipe(
  //   ofType(getLatestTransactions),
  //   withLatestFrom(this.store.select(accounts), this.store.select(transactions)),
  //   switchMap(([action, accounts, transactions]) => concat(
  //     of(startLoad('refreshTransactions')),
  //     this.db.transactions$(action.payload).pipe(
  //       switchMap(response => {
  //         const accountActions = accounts.filter(a => a.accessToken === action.payload.accessToken).map(account => updateAccount(new Account({
  //           ...account,
  //           cursor: response.next_cursor,
  //           lastUpdated: new Date()
  //         })));
  //         const removeActions = response.removed.map(item => removeTransaction(item.transaction_id));
  //         const addAction = addTransactions(response.added.map(item => new Transaction({
  //           id: item.transaction_id,
  //           date: new Date(item.date).getTime(),
  //           accountId: item.account_id,
  //           amount: item.amount,
  //           categoryId: item.personal_finance_category.detailed,
  //           merchant: item.merchant_name,
  //           name: item.name,
  //         })));
  //         const updateActions = response.modified.map(item => {
  //           const existing = transactions.find(t => t.id === item.transaction_id);
  //           return updateTransaction(new Transaction({
  //             ...existing,
  //             id: item.transaction_id,
  //             date: new Date(item.date),
  //             accountId: item.account_id,
  //             amount: item.amount,
  //             categoryId: item.personal_finance_category.detailed,
  //             merchant: item.merchant_name,
  //             name: item.name,
  //           }));
  //         });
  //         return [...accountActions, ...removeActions, addAction, ...updateActions];
  //       }),
  //       finalize(() => { this.store.dispatch(endLoad('refreshTransactions')) }),
  //       catchError(() => concat(accounts.filter(a => a.accessToken === action.payload.accessToken).map(account => updateAccount(new Account({
  //         ...account,
  //         failure: true
  //       })))))
  //     )
  //   ))
  // ));

  saveState$ = createEffect(() => this.actions$.pipe(
    ofType(saveState),
    withLatestFrom(this.store),
    tap(([_, state]) => {
      this.store.dispatch(startLoad('savingState'));
      this.persistence.saveState(state);
      this.store.dispatch(endLoad('savingState'));
    })
  ), { dispatch: false });

  loadState$ = createEffect(() => this.actions$.pipe(
    ofType(loggedIn),
    filter(action => !!action.payload),
    switchMap(() => of(
      restoreState(this.persistence.restoreState()),
      stateRestored()
    )),
  ));

}
function getAccountBalances(accessToken: string): any {
  throw new Error("Function not implemented.");
}

