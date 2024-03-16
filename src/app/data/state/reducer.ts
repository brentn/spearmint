import { Action, createReducer, on } from "@ngrx/store";
import { MainState } from ".";

import { addAccount, addTransactions, loggedIn, reset, restoreState, updateConfiguration, updateTransaction } from "./actions";
import { DEFAULT_CONFIGURATION } from "../types/configuration.type";
import { DEFAULT_CATEGORIES } from "../types/category.type";
import { Transaction } from "../models/transaction";

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
  on(updateConfiguration, (state, action) => ({
    ...state,
    configuration: action.payload
  })),
  on(reset, (state) => ({
    ...state,
    accounts: [],
    transactions: []
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
    transactions: state.transactions.map(transaction => transaction.id === action.payload.id ? new Transaction({
      ...transaction,
      ...action.payload
    } as Transaction) : transaction)
  }))
);

export function mainReducer(state: MainState | undefined, action: Action) {
  return reducer(state, action);
}

