import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from './app.module';
import { from, map, switchMap } from 'rxjs';
import { initialize, reset } from './data/state/actions';
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
  supportsWebauthn = client.isAvailable();
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
          switchMap(authentication => this.bank.authenticateUser$(authentication).pipe(
            map(() => {
              console.log('User Authenticated');
              return user;
            })
          ))
        );
      } else {
        console.log('Registering user...');
        return from(client.register("Spearmint User", challenge, {
          authenticatorType: "auto",
          userVerification: "required",
          timeout: 60000,
          attestation: false,
          debug: false
        })).pipe(
          switchMap(registration => this.bank.registerUser$(registration).pipe(
            map(user => {
              localStorage.setItem('user', JSON.stringify(user));
              console.log('User Registered');
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

  onReset(): void {
    if (confirm('this will reset EVERYTHING')) {
      this.store.dispatch(reset());
    }
  }
}
