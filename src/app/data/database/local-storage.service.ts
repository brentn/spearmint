import { Injectable } from '@angular/core';
import { IPersistence } from './iPersistence.ingerface';
import { AppState } from 'src/app/app.module';
import { initialState as mainState } from '../state/reducer';

const KEY = 'SpearmintData';

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService implements IPersistence {

  constructor() { }
  saveState(state: AppState): void {
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  restoreState(): AppState {
    const defaultState = JSON.stringify({ main: mainState });
    return JSON.parse(localStorage.getItem(KEY) || defaultState);
  }
}
