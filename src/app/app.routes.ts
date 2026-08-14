import { Routes } from '@angular/router';
import { Overview } from './screens/overview/overview';
import { Budgets } from './screens/budgets/budgets';
import { Transactions } from './screens/transactions/transactions';
import { Settings } from './screens/settings/settings';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  { path: 'overview', component: Overview },
  { path: 'budgets', component: Budgets },
  { path: 'transactions', component: Transactions },
  { path: 'settings', component: Settings },
];
