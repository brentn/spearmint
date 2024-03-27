import { Injectable } from '@angular/core';
import { IPersistence } from './iPersistence.ingerface';
import { AppState } from 'src/app/app.module';
import { initialState as mainState } from '../state/reducer';
import { Store } from '@ngrx/store';
import { user } from '../state/selectors';
import { Observable, filter, map, take, tap } from 'rxjs';

const KEY = 'SpearmintData';

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService implements IPersistence {
  userId: string | undefined

  constructor(private store: Store<AppState>) {
    this.store.select(user).pipe(
      filter(user => !!user),
      take(1),
      tap(user => this.userId = user!.id)
    ).subscribe();
  }

  saveState(state: AppState): void {
    if (this.userId) {
      localStorage.setItem(`${KEY}.${this.userId}`, JSON.stringify(state));
    }
  }
  restoreState(): AppState {
    const defaultState = JSON.stringify({ main: mainState });
    if (this.userId) {
      return JSON.parse(localStorage.getItem(`${KEY}.${this.userId}`) || defaultState);
    }
    return { main: mainState };
  }
}
