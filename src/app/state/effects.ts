import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { loggedIn, restoreState, saveState } from "./actions";
import { filter, map, switchMap, tap, withLatestFrom } from "rxjs";
import { LocalStorageService } from "./persistence/local-storage.service";
import { Store } from "@ngrx/store";
import { AppState } from "../app.module";

@Injectable()
export class MainEffects {

  constructor(
    private actions$: Actions,
    private store: Store<AppState>,
    private persistence: LocalStorageService
  ) { }

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
