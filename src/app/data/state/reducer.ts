import { Action, createReducer, on } from "@ngrx/store";
import { MainState } from ".";

import { endLoad, loggedIn, selectAccount, selectBudget, setLinkToken, startLoad, updateConfiguration } from "./actions";
import { DEFAULT_CONFIGURATION } from "../types/configuration.type";

export const initialState: MainState = {
  user: undefined,
  linkToken: undefined,
  configuration: DEFAULT_CONFIGURATION,
  loading: [],
  selectedAccount: undefined,
  selectedBudget: undefined,
}

const reducer = createReducer(initialState,
  on(loggedIn, (state, action) => ({ ...state, user: action.payload })),
  on(updateConfiguration, (state, action) => ({ ...state, configuration: action.payload })),
  on(startLoad, (state, action) => ({ ...state, loading: [...state.loading, action.payload] })),
  on(endLoad, (state, action) => ({ ...state, loading: state.loading.filter((_, i) => i !== state.loading.indexOf(action.payload)) })),
  on(setLinkToken, (state, action) => ({ ...state, linkToken: action.payload })),
  on(selectAccount, (state, action) => ({ ...state, selectedAccount: action.payload, selectedBudget: undefined })),
  on(selectBudget, (state, action) => ({ ...state, selectedBudget: action.payload, selectedAccount: undefined })),
);

export function mainReducer(state: MainState | undefined, action: Action) {
  return reducer(state, action);
}

