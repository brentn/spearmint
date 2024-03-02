import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';
import { GraphComponent } from './home/graph/graph.component';
import { MainState } from './state';
import { StoreModule } from '@ngrx/store';
import { mainReducer } from './state/reducer';
import { EffectsModule } from '@ngrx/effects';
import { MainEffects } from './state/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { HomeViewComponent } from './home/home-view.component';
import { AccountComponent } from './home/account/account.component';
import { AccountTypeComponent } from './home/account-type/account-type.component';
import { NewAccountComponent } from './new-account/new-account.component';
import { SettingsComponent } from './settings/settings.component';
import { NavbarComponent } from './home/navbar/navbar.component';
import { TransactionsComponent } from './transactions/transactions.component';
import { TransactionComponent } from './transactions/transaction/transaction.component';
import { AccountIconComponent } from './home/account/account-icon/account-icon.component';
import { CategoryIconComponent } from './transactions/transaction/category-icon/category-icon.component';
import { BudgetsComponent } from './budgets/budgets.component';
import { HomeBudgetsComponent } from './home/budgets/budgets.component';

export type AppState = {
  main: MainState
}

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    HomeViewComponent,
    GraphComponent,
    AccountComponent,
    AccountTypeComponent,
    NewAccountComponent,
    SettingsComponent,
    NavbarComponent,
    TransactionsComponent,
    TransactionComponent,
    AccountIconComponent,
    CategoryIconComponent,
    BudgetsComponent,
    HomeBudgetsComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FontAwesomeModule,
    StoreModule.forRoot({ main: mainReducer }),
    EffectsModule.forRoot([MainEffects]),
    StoreDevtoolsModule.instrument({
      maxAge: 25, // Retains last 25 states
      logOnly: !isDevMode(), // Restrict extension to log-only mode
    }),
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
