import { createAction } from "@ngrx/store";
import { SocialUser } from "@abacritt/angularx-social-login";
import { AppState } from "src/app/app.module";
import { Account } from "../models/account";
import { Transaction } from "../models/transaction";

export const loggedIn = createAction('[Main] Logged in', (user: SocialUser) => user);

export const saveState = createAction('[Main] Save state');
export const restoreState = createAction('[Main] Restore state', (payload: AppState) => ({ payload }));

export const addAccount = createAction('[Account] Add account', (payload: Account) => ({ payload }));
export const addTransactions = createAction('[Transaction] Add transactions', (payload: Transaction[]) => ({ payload }));
export const updateTransaction = createAction('[Transaction] Update transaction', (payload: Transaction) => ({ payload }));
