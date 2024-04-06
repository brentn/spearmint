import { createAction } from "@ngrx/store";
import { SocialUser } from "@abacritt/angularx-social-login";
import { AppState } from "src/app/app.module";
import { Account } from "../models/account";
import { Transaction } from "../models/transaction";
import { Configuration } from "../types/configuration.type";

export const initialize = createAction('[Main] Initialize');
export const startLoad = createAction('[Main] Start loading...', (payload: string) => ({ payload }));
export const endLoad = createAction('[Main] End loading', (payload: string) => ({ payload }));
export const loggedIn = createAction('[Main] Logged in', (payload: SocialUser) => ({ payload }));

export const reset = createAction('[Main] Reset');
export const saveState = createAction('[Main] Save state');
export const restoreState = createAction('[Main] Restore state', (payload: AppState) => ({ payload }));
export const stateRestored = createAction('[Main] State restored');

export const getLinkToken = createAction('[Plaid] Get link token');
export const setLinkToken = createAction('[Plaid] - Set link token', (payload: string) => ({ payload }));

export const updateConfiguration = createAction('[Configuration] Update configuration', (payload: Configuration) => ({ payload }));
export const refreshAccounts = createAction('[Account] Refresh accounts');
export const addAccount = createAction('[Account] Add account', (payload: Account) => ({ payload }));
export const accountAdded = createAction('[Account] Account added', (payload: Account) => ({ payload }));
export const updateAccount = createAction('[Account] Update account', (payload: Account) => ({ payload }));
export const accountUpdated = createAction('[Account] Account updated', (payload: Account) => ({ payload }));
export const getAccountBalances = createAction('[Bank] Get account balances', (payload: string) => ({ payload }));

export const getLatestTransactions = createAction('[Bank] Get latest transactions', (payload: { accessToken: string, cursor: string | undefined }) => ({ payload }));
export const addTransactions = createAction('[Transaction] Add transactions', (payload: Transaction[]) => ({ payload }));
export const transactionsAdded = createAction('[Transaction] Transactions added', (payload: Transaction[]) => ({ payload }));
export const updateTransaction = createAction('[Transaction] Update transaction', (payload: Transaction) => ({ payload }));
export const transactionUpdated = createAction('[Transaction] Transaction updated', (payload: Transaction) => ({ payload }));
export const removeTransaction = createAction('[Transaction] Remove transaction', (payload: string) => ({ payload }));
export const transactionRemoved = createAction('[Transaction] Transaction removed', (payload: string) => ({ payload }));
