import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { endLoad, getAccountBalances, getLatestTransactions, getLinkToken, initialize, loggedIn, refreshAccounts, restoreState, saveState, setLinkToken, startLoad, stateRestored, updateAccount } from "./actions";
import { concat, concatMap, filter, finalize, from, map, of, switchMap, take, tap, withLatestFrom } from "rxjs";
import { Store } from "@ngrx/store";
import { AppState } from "src/app/app.module";
import { LocalStorageService } from "../database/local-storage.service";
import { DatabaseService } from "../database/database.service";
import { accounts } from "./selectors";
import { Account } from "../models/account";

const MIN_REFRESH_FREQUENCY = 120; //minutes

@Injectable()
export class MainEffects {

  constructor(
    private actions$: Actions,
    private store: Store<AppState>,
    private db: DatabaseService,
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

  refreshAccounts$ = createEffect(() => this.actions$.pipe(
    ofType(stateRestored, refreshAccounts),
    withLatestFrom(this.store.select(state => state.main)),
    switchMap(([_, state]) => concat(
      of(startLoad('refresh')),
      state.accounts
        // .filter(account => ((Date.now() - account.lastUpdated.getTime()) > (MIN_REFRESH_FREQUENCY * 60 * 1000)))
        .filter(account => !!account.accessToken)
        .map(account => account.accessToken!)
        .reduce((acc: string[], token) => acc.includes(token) ? acc : [...acc, token], [])
        .map(access_token => (getAccountBalances(access_token))),
      of(endLoad('refresh'))
    ))
  ));

  getAccountBalances$ = createEffect(() => this.actions$.pipe(
    ofType(getAccountBalances),
    withLatestFrom(this.store.select(accounts)),
    switchMap(([action, accounts]) => concat(
      of(startLoad('getBalances')),
      this.db.accountBalances$(action.payload).pipe(
        map(dto => {
          const result: Account[] = [];
          dto.forEach(item => {
            const account = accounts.find(a => a.id === item.account_id);
            if (account) result.push(new Account({ ...account, balance: item.balances.current }));
          });
          return result;
        }),
        switchMap(accounts => accounts.map(account => updateAccount(account))),
        finalize(() => { this.store.dispatch(endLoad('getBalances')) })
      )
    ))
  ));

  getLatestTransactions$ = createEffect(() => this.actions$.pipe(
    ofType(getLatestTransactions),
    //TODO:
  ));

  saveState$ = createEffect(() => this.actions$.pipe(
    ofType(saveState),
    withLatestFrom(this.store),
    tap(([_, state]) => this.persistence.saveState(state))
  ), { dispatch: false });

  loadState$ = createEffect(() => this.actions$.pipe(
    ofType(loggedIn),
    filter(user => !!user),
    switchMap(() => of(
      restoreState(this.persistence.restoreState()),
      stateRestored()
    )),
  ));

}
