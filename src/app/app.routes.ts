import { Routes } from '@angular/router';
import { Overview } from './screens/overview/overview';
import { Budgets } from './screens/budgets/budgets';
import { BudgetDetail } from './screens/budgets/budget-detail/budget-detail';
import { Transactions } from './screens/transactions/transactions';
import { Settings } from './screens/settings/settings';
import { CategoriesScreen } from './screens/settings/categories/categories';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  { path: 'overview', component: Overview },
  { path: 'budgets', component: Budgets },
  { path: 'budgets/:id', component: BudgetDetail },
  { path: 'transactions', component: Transactions },
  { path: 'settings', component: Settings },
  {
    // Lazy-loaded: pushed the initial bundle over the 1MB CI budget (by ~5kB) once the
    // shared SettingsHeader/CategoryPicker additions landed. Accounts is a settings
    // sub-screen most sessions never visit, same reasoning as export-import below.
    path: 'settings/accounts',
    loadComponent: () => import('./screens/settings/accounts/accounts').then((m) => m.AccountsScreen),
  },
  { path: 'settings/categories', component: CategoriesScreen },
  {
    // Lazy-loaded to match the sibling settings sub-screens' pattern (accounts,
    // export-import) — unlike those, this route has no heavy dependency of its
    // own to keep out of the main bundle; it's just a rarely-visited screen.
    path: 'settings/security',
    loadComponent: () => import('./screens/settings/security/security').then((m) => m.SecurityScreen),
  },
  {
    // Lazy-loaded: this screen's BackupService pulls in crypto-js (~600kB
    // unminified, non-tree-shakeable CommonJS) for the optional export
    // encryption, which is too heavy to ship in the app's eagerly-loaded
    // initial bundle for a screen most sessions never visit.
    path: 'settings/export-import',
    loadComponent: () => import('./screens/settings/export-import/export-import').then((m) => m.ExportImportScreen),
  },
];
