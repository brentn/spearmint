import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { endLoad, getAccountBalance, getLatestTransactions, loggedIn, refresh, restoreState, saveState, startLoad } from "./actions";
import { concat, map, of, switchMap, tap, withLatestFrom } from "rxjs";
import { Store } from "@ngrx/store";
import { AppState } from "src/app/app.module";
import { LocalStorageService } from "../database/local-storage.service";

const MIN_REFRESH_FREQUENCY = 120; //minutes

@Injectable()
export class MainEffects {

  constructor(
    private actions$: Actions,
    private store: Store<AppState>,
    private persistence: LocalStorageService
  ) { }

  refresh$ = createEffect(() => this.actions$.pipe(
    ofType(refresh),
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
    map(() => restoreState(this.persistence.restoreState()))
  ));

}
