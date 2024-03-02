import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { SettingsComponent } from './settings/settings.component';
import { NewAccountComponent } from './new-account/new-account.component';
import { TransactionsComponent } from './transactions/transactions.component';

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
