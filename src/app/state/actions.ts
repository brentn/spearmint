import { createAction } from "@ngrx/store";
import { SocialUser } from "@abacritt/angularx-social-login";
import { Transaction } from "./types/transaction.type";
import { AppState } from "../app.module";

export const loggedIn = createAction('[Main] Logged in', (user: SocialUser) => user);

export const saveState = createAction('[Main] Save state');
export const restoreState = createAction('[Main] Restore state', (payload: AppState) => ({ payload }));
