import { ApplicationRef, Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { accountAdded, accountUpdated, addAccount, addTransactions, endLoad, getLatestTransactions, getLinkToken, initialize, refreshAccounts, reset, setLinkToken, startLoad, transactionUpdated, transactionsAdded, updateAccount, updateTransaction, getAccountBalances, removeTransaction, transactionRemoved, updateLinkToken, refreshAccountsImmediately, selectBudget, updateConfiguration, serverResponding } from "./actions";
import { catchError, concat, filter, finalize, map, of, switchMap, tap, withLatestFrom } from "rxjs";
import { Action, Store } from "@ngrx/store";
import { AppState } from "src/app/app.module";
import { BankingConnectorService } from "../database/banking-connector.service";
import { Account } from "../models/account";
import { DBStateService } from "../database/dbState.service";
import { Transaction } from "../models/transaction";
import { NgxPlaidLinkService, PlaidSuccessMetadata } from "ngx-plaid-link";
import { ToastrService } from "ngx-toastr";

const MIN_REFRESH_FREQUENCY = 30; //minutes

@Injectable()
export class MainEffects {

  constructor(
    private actions$: Actions,
    private store: Store<AppState>,
    private bank: BankingConnectorService,
    private dbState: DBStateService,
    private toast: ToastrService,
    private plaidLinkService: NgxPlaidLinkService,
  ) { }

  spinUpServer$ = createEffect(() => this.actions$.pipe(
    ofType(initialize),
    tap(() => this.bank.spinUpServer$().subscribe(() => this.store.dispatch(serverResponding()))),
    tap(() => localStorage.getItem('configuration')
      ? this.store.dispatch(updateConfiguration(JSON.parse(localStorage.getItem('configuration')!)))
      : null
    )
  ), { dispatch: false });

  getLinkToken$ = createEffect(() => this.actions$.pipe(
    ofType(getLinkToken),
    switchMap(action => this.bank.getLinkToken$().pipe(
      map(linkToken => setLinkToken(linkToken))
    ))
  ));

  updateLinkToken$ = createEffect(() => this.actions$.pipe(
    ofType(updateLinkToken),
    switchMap(action => this.bank.updateLinkToken$(action.payload.accessToken).pipe(
      map(token => {
        this.plaidLinkService.createPlaid({
          token: token,
          onSuccess: (publicToken: string, metadata: PlaidSuccessMetadata) => { this.store.dispatch(action.payload.action) },
        }).then((handler: any) => {
          // this.plaidLinkHandler = handler;
          handler.open();
        });
      })))
  ), { dispatch: false });

  updateConfiguration$ = createEffect(() => this.actions$.pipe(
    ofType(updateConfiguration),
    tap(action => localStorage.setItem('configuration', JSON.stringify(action.payload)))
  ), { dispatch: false });

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

  removeTransaction$ = createEffect(() => this.actions$.pipe(
    ofType(removeTransaction),
    switchMap(action => this.dbState.Transactions.delete$(action.payload)),
    map(transaction => transactionRemoved(transaction))
  ));

  reset$ = createEffect(() => this.actions$.pipe(
    ofType(reset),
    switchMap(() => this.dbState.Transactions.reset$()),
    switchMap(() => this.dbState.Accounts.reset$()),
    tap(() => localStorage.clear())
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

  refreshAccountsNow$ = createEffect(() => this.actions$.pipe(
    ofType(refreshAccountsImmediately),
    switchMap(() => this.dbState.storeReady$),
    withLatestFrom(this.dbState.accounts$),
    switchMap(([_, accounts]) => concat(
      of(startLoad('refresh')),
      ...accounts
        .filter(account => !!account.accessToken)
        .reduce((acc: Account[], item) => acc.find(a => a.accessToken === item.accessToken) ? acc : [...acc, item], [])
        .map(account => [getAccountBalances(account.accessToken), getLatestTransactions(account)]),
      of(endLoad('refresh'))
    ))
  ));

  getAccountBalances$ = createEffect(() => this.actions$.pipe(
    ofType(getAccountBalances),
    withLatestFrom(this.dbState.accounts$),
    switchMap(([action, accounts]) => concat(
      of(startLoad('refreshBalances')),
      this.bank.accountBalances$(action.payload).pipe(
        switchMap(balances =>
          balances.map(balance => {
            const account = accounts.find(a => a.id === balance.account_id);
            return account ? updateAccount({
              ...account,
              balance: balance.balances.current,
              lastUpdated: new Date().getTime(),
              failure: undefined
            }) : null;
          }).filter(a => !!a) as Action[]
        ),
        finalize(() => { this.store.dispatch(endLoad('refreshBalances')) }),
        catchError(err => {
          accounts.filter(a => a.accessToken === action.payload).map(account => this.store.dispatch(updateAccount(new Account({ ...account, failure: true }))));
          switch (err.status) {
            case 401: this.store.dispatch(updateLinkToken({ accessToken: action.payload, action: refreshAccounts() }));
          }
          return of();
        }),
      )
    ))
  ));

  getLatestTransactions$ = createEffect(() => this.actions$.pipe(
    ofType(getLatestTransactions),
    withLatestFrom(this.dbState.accounts$, this.dbState.transactions$),
    switchMap(([action, accounts, transactions]) => concat(
      of(startLoad('refreshTransactions')),
      this.bank.transactions$(action.payload).pipe(
        switchMap(response => {
          const accountActions = accounts.filter(a => a.accessToken === action.payload.accessToken).map(account => updateAccount(new Account({
            ...account,
            cursor: response.next_cursor,
            lastUpdated: new Date()
          })));
          const removeActions = response.removed.map(item => removeTransaction(item.transaction_id));
          const newItems = response.added.filter(item => !transactions.find(t => t.id === item.transaction_id));
          const addAction = addTransactions(newItems.map(item => new Transaction({
            id: item.transaction_id,
            date: new Date(item.date).getTime(),
            accountId: item.account_id,
            amount: item.amount,
            categoryId: item.personal_finance_category.detailed,
            merchant: item.merchant_name,
            name: item.name,
          })));
          const updateActions = response.modified.map(item => {
            const existing = transactions.find(t => t.id === item.transaction_id);
            return updateTransaction(new Transaction({
              ...existing,
              id: item.transaction_id,
              date: new Date(item.date),
              accountId: item.account_id,
              amount: item.amount,
              categoryId: item.personal_finance_category.detailed,
              merchant: item.merchant_name,
              name: item.name,
            }));
          });
          return [...accountActions, ...removeActions, addAction, ...updateActions];
        }),
        finalize(() => { this.store.dispatch(endLoad('refreshTransactions')) }),
        catchError(err => {
          accounts.filter(a => a.accessToken === action.payload.accessToken).map(account => this.store.dispatch(updateAccount(new Account({ ...account, failure: true }))));
          switch (err.status) {
            case 401: this.store.dispatch(updateLinkToken({ accessToken: action.payload.accessToken, action: refreshAccounts() }));
          }
          return of();
        }),
      )
    ))
  ));

}


