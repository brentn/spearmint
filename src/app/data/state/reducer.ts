import { Action, createReducer, on } from "@ngrx/store";
import { MainState } from ".";

import { endLoad, loggedIn, reset, restoreState, setLinkToken, startLoad, updateConfiguration } from "./actions";
import { DEFAULT_CONFIGURATION } from "../types/configuration.type";

export const initialState: MainState = {
  user: undefined,
  linkToken: undefined,
  configuration: DEFAULT_CONFIGURATION,
  loading: [],
}

const reducer = createReducer(initialState,
  on(loggedIn, (state, action) => ({ ...state, user: action.payload })),
  on(updateConfiguration, (state, action) => ({ ...state, configuration: action.payload })),
  on(startLoad, (state, action) => ({ ...state, loading: [...state.loading, action.payload] })),
  on(endLoad, (state, action) => ({ ...state, loading: state.loading.filter((_, i) => i !== state.loading.indexOf(action.payload)) })),
  on(setLinkToken, (state, action) => ({ ...state, linkToken: action.payload })),
  on(restoreState, (state, action) => ({
    ...action.payload.main,
    linkToken: undefined,
    user: state.user,
    loading: []
  })),
);

export function mainReducer(state: MainState | undefined, action: Action) {
  return reducer(state, action);
}

