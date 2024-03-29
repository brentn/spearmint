import { AppState } from "src/app/app.module";

export const user = (state: AppState) => state.main.user;
export const configuration = (state: AppState) => state.main.configuration;
export const linkToken = (state: AppState) => state.main.linkToken;
export const accounts = (state: AppState) => state.main.accounts;
export const transactions = (state: AppState) => state.main.transactions;
export const categories = (state: AppState) => state.main.categories;
export const budgets = (state: AppState) => state.main.budgets;
export const isLoading = (state: AppState) => !!state.main.loading.length;
export const isRefreshing = (state: AppState) => !!state.main.loading.find(a => a.includes('refresh'));
