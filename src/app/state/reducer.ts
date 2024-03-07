import { Action, createReducer, on } from "@ngrx/store";
import { MainState } from ".";
import { DEFAULT_CONFIGURATION } from "./types/configuration.type";
import { DEFAULT_CATEGORIES } from "./types/category.type";
import { loggedIn, restoreState } from "./actions";

export const initialState: MainState = {
  user: undefined,
  configuration: DEFAULT_CONFIGURATION,
  accounts: [],
  transactions: [],
  categories: DEFAULT_CATEGORIES,
  budgets: [],
}

const reducer = createReducer(initialState,
  on(loggedIn, (state, action) => ({ ...state, user: action })),
  on(restoreState, (state, action) => ({
    ...action.payload.main,
    user: state.user
  })),
);

export function mainReducer(state: MainState | undefined, action: Action) {
  return reducer(state, action);
}

