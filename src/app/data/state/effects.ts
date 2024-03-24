import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { endLoad, getAccountBalance, getLatestTransactions, getLinkToken, initialize, loggedIn, refreshAccounts, restoreState, saveState, setLinkToken, startLoad } from "./actions";
import { concat, filter, map, of, switchMap, take, tap, withLatestFrom } from "rxjs";
import { Store } from "@ngrx/store";
import { AppState } from "src/app/app.module";
import { LocalStorageService } from "../database/local-storage.service";
import { DatabaseService } from "../database/database.service";

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
    ofType(refreshAccounts),
    withLatestFrom(this.store.select(state => state.main)),
    switchMap(([_, state]) => concat(
      of(startLoad('refresh')),
      state.accounts
        .filter(account => ((Date.now() - account.lastUpdated.getTime()) > (MIN_REFRESH_FREQUENCY * 60 * 1000)))
        .map(account => (getAccountBalance(account), getLatestTransactions(account))),
      of(endLoad('refresh'))
    ))
  ));

  getAccountBalance$ = createEffect(() => this.actions$.pipe(
    ofType(getAccountBalance),
    //TODO:
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
    map(() => restoreState(this.persistence.restoreState()))
  ));

}
