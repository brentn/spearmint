import { Action, createReducer } from "@ngrx/store";
import { AppState } from ".";
import { DEFAULT_CONFIGURATION } from "./types/configuration.type";

const initialState: AppState = {
  configuration: DEFAULT_CONFIGURATION,
  accounts: [],
  transactions: [],
  categories: [],
}

const reducer = createReducer(initialState,
);

export function appReducer(state: AppState | undefined, action: Action) {
  return reducer(state, action);
}

