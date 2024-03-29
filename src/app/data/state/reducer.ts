import { Action, createReducer, on } from "@ngrx/store";
import { MainState } from ".";

import { addAccount, addTransactions, endLoad, loggedIn, removeTransaction, reset, restoreState, setLinkToken, startLoad, updateAccount, updateConfiguration, updateTransaction } from "./actions";
import { DEFAULT_CONFIGURATION } from "../types/configuration.type";
import { DEFAULT_CATEGORIES } from "../types/category.type";
import { Transaction } from "../models/transaction";
import { Account } from "../models/account";

export const initialState: MainState = {
  user: undefined,
  linkToken: undefined,
  configuration: DEFAULT_CONFIGURATION,
  loading: [],
  accounts: [],
  transactions: [],
  categories: DEFAULT_CATEGORIES,
  budgets: [],
}

const reducer = createReducer(initialState,
  on(loggedIn, (state, action) => ({ ...state, user: action.payload })),
  on(reset, (state) => ({ ...state, accounts: [], transactions: [] })),
  on(restoreState, (state, action) => ({ ...action.payload.main, linkToken: undefined, user: state.user, })),
  on(updateConfiguration, (state, action) => ({ ...state, configuration: action.payload })),
  on(startLoad, (state, action) => ({ ...state, loading: [...state.loading, action.payload] })),
  on(endLoad, (state, action) => ({ ...state, loading: state.loading.filter((_, i) => i !== state.loading.indexOf(action.payload)) })),
  on(setLinkToken, (state, action) => ({ ...state, linkToken: action.payload })),
  on(addAccount, (state, action) => ({
    ...state,
    accounts: [...state.accounts, action.payload]
  })),
  on(updateAccount, (state, action) => ({
    ...state,
    accounts: state.accounts.map(account => account.id === action.payload.id ? new Account(action.payload) : account)
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
  })),
  on(removeTransaction, (state, action) => ({
    ...state,
    transactions: state.transactions.filter(transaction => transaction.id !== action.payload)
  })),
);

export function mainReducer(state: MainState | undefined, action: Action) {
  return reducer(state, action);
}

