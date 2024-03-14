import { Action, createReducer, on } from "@ngrx/store";
import { MainState } from ".";

import { addAccount, addTransactions, loggedIn, restoreState, updateTransaction } from "./actions";
import { DEFAULT_CONFIGURATION } from "../types/configuration.type";
import { DEFAULT_CATEGORIES } from "../types/category.type";

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
    user: state.user,
  })),
  on(addAccount, (state, action) => ({
    ...state,
    accounts: [...state.accounts, action.payload]
  })),
  on(addTransactions, (state, action) => ({
    ...state,
    transactions: [...state.transactions, ...action.payload]
  })),
  on(updateTransaction, (state, action) => ({
    ...state,
    transactions: state.transactions.map(transaction => transaction.id === action.payload.id ? {
      ...transaction,
      ...action.payload
    } : transaction)
  }))
);

export function mainReducer(state: MainState | undefined, action: Action) {
  return reducer(state, action);
}

