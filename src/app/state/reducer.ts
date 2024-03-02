import { Action, createReducer } from "@ngrx/store";
import { MainState } from ".";
import { DEFAULT_CONFIGURATION } from "./types/configuration.type";
import { DEFAULT_CATEGORIES } from "./types/category.type";

const initialState: MainState = {
  configuration: DEFAULT_CONFIGURATION,
  accounts: [],
  transactions: [],
  categories: DEFAULT_CATEGORIES,
  budgets: [],
}

const reducer = createReducer(initialState
);

export function mainReducer(state: MainState | undefined, action: Action) {
  return reducer(state, action);
}

