import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from './app.module';
import { from, map, switchMap, tap } from 'rxjs';
import { initialize, loggedIn } from './data/state/actions';
import { isRefreshing } from './data/state/selectors';
import 'zone.js/plugins/zone-patch-rxjs'; // This is required for Angular to work with RxJS
import { BankingConnectorService } from './data/database/banking-connector.service';
import { client } from '@passwordless-id/webauthn';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  isRefreshing$ = this.store.select(isRefreshing);
  authenticated$ = this.bank.getChallenge$().pipe(
    switchMap(challenge => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.credential) {
        console.log('Authenticating user...');
        return from(client.authenticate([user.credential.id], challenge, {
          authenticatorType: "auto",
          userVerification: "required",
          timeout: 60000,
          debug: false
        })).pipe(
          map(authentication => this.bank.authenticateUser$(authentication).pipe(
            map(() => {
              console.log('User Authenticated', user);
              return user;
            })
          ))
        );
      } else {
        console.log('Registering user...');
        return from(client.register("spearmint", challenge, {
          authenticatorType: "auto",
          userVerification: "required",
          timeout: 60000,
          attestation: false,
          debug: false
        })).pipe(
          map(registration => this.bank.registerUser$(registration).pipe(
            map(user => {
              localStorage.setItem('user', JSON.stringify(user));
              console.log('User', user);
              return user;
            }),
          ))
        );
      }
    }),
  );

  constructor(private store: Store<AppState>, private bank: BankingConnectorService) { }

  ngOnInit(): void {
    this.store.dispatch(initialize());
  }
}
