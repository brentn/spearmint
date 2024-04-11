import { AppState } from "src/app/app.module";

export const user = (state: AppState) => state.main.user;
export const configuration = (state: AppState) => state.main.configuration;
export const linkToken = (state: AppState) => state.main.linkToken;
export const isLoading = (state: AppState) => !!state.main.loading.length;
export const isRefreshing = (state: AppState) => !!state.main.loading.find(a => a.startsWith('refresh'));
export const selectedAccount = (state: AppState) => state.main.selectedAccount;

