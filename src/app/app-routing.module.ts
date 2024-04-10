import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { SettingsComponent } from './settings/settings.component';
import { NewAccountComponent } from './home/account/new-account/new-account.component';
import { TransactionsComponent } from './transactions/transactions.component';
import { BudgetsComponent } from './budgets/budgets.component';

const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: HomeComponent
  },
  {
    path: 'accounts/new',
    pathMatch: 'full',
    component: NewAccountComponent
  },
  {
    path: 'transactions',
    pathMatch: 'full',
    component: TransactionsComponent
  },
  {
    path: 'budgets',
    pathMatch: 'full',
    component: BudgetsComponent
  },
  {
    path: 'settings',
    pathMatch: 'full',
    component: SettingsComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
