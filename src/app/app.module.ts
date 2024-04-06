import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { SocialLoginModule, SocialAuthServiceConfig, GoogleLoginProvider, GoogleSigninButtonModule } from "@abacritt/angularx-social-login";

import { AppRoutingModule } from './app-routing.module';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';
import { GraphComponent } from './home/graph/graph.component';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
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
import { CategoryIconComponent } from './categories/category-icon/category-icon.component';
import { BudgetsComponent } from './budgets/budgets.component';
import { HomeBudgetsComponent } from './home/budgets/budgets.component';
import { TransactionsViewComponent } from './transactions/transactions-view.component';
import { NgxPlaidLinkModule } from 'ngx-plaid-link';
import { TransactionFormComponent } from './transactions/transaction/form/transaction-form.component';
import { CategoryPickerComponent } from './categories/category-picker/category-picker.component';
import { CategoryItemComponent } from './categories/category-picker/item/category.component';
import { MainState } from './data/state';
import { mainReducer } from './data/state/reducer';
import { MainEffects } from './data/state/effects';
import { BankingConnectorService } from './data/database/banking-connector.service';
import { SnakecasePipe } from './utilities/snakecase.pipe';
import { TokenInterceptorService } from './auth/interceptor/token-interceptor.service';
import { DBStateService } from './data/database/dbState.service';

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
    HomeBudgetsComponent,
    TransactionsViewComponent,
    TransactionFormComponent,
    CategoryPickerComponent,
    CategoryItemComponent,
    SnakecasePipe,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
    FontAwesomeModule,
    SocialLoginModule,
    GoogleSigninButtonModule,
    NgxPlaidLinkModule,
    StoreModule.forRoot({ main: mainReducer }),
    EffectsModule.forRoot([MainEffects]),
    StoreDevtoolsModule.instrument({
      maxAge: 25, // Retains last 25 states
      logOnly: !isDevMode(), // Restrict extension to log-only mode
    }),
  ],
  providers: [
    {
      provide: 'SocialAuthServiceConfig',
      useValue: {
        autoLogin: true,
        providers: [
          {
            id: GoogleLoginProvider.PROVIDER_ID,
            provider: new GoogleLoginProvider('316624811771-jugmh69v4b636shvv1c9gtj6glr5i9e7.apps.googleusercontent.com', {
              scopes: 'openid profile',
            }),
          },
        ],
        onError: (err: any) => {
          console.error(err);
        },
      } as SocialAuthServiceConfig,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: TokenInterceptorService,
      multi: true
    },
    BankingConnectorService,
    DBStateService,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
