import { AppState } from "../app.module";

export const user = (state: AppState) => state.main.user;
export const configuration = (state: AppState) => state.main.configuration;
export const accounts = (state: AppState) => state.main.accounts;
export const transactions = (state: AppState) => state.main.transactions;
export const categories = (state: AppState) => state.main.categories;
export const budgets = (state: AppState) => state.main.budgets;
