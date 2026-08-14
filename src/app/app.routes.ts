import { Routes } from '@angular/router';
import { Overview } from './screens/overview/overview';
import { Budgets } from './screens/budgets/budgets';
import { BudgetDetail } from './screens/budgets/budget-detail/budget-detail';
import { Transactions } from './screens/transactions/transactions';
import { Settings } from './screens/settings/settings';
import { AccountsScreen } from './screens/settings/accounts/accounts';
import { CategoriesScreen } from './screens/settings/categories/categories';
import { ExportImportScreen } from './screens/settings/export-import/export-import';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  { path: 'overview', component: Overview },
  { path: 'budgets', component: Budgets },
  { path: 'budgets/:id', component: BudgetDetail },
  { path: 'transactions', component: Transactions },
  { path: 'settings', component: Settings },
  { path: 'settings/accounts', component: AccountsScreen },
  { path: 'settings/categories', component: CategoriesScreen },
  { path: 'settings/export-import', component: ExportImportScreen },
];
