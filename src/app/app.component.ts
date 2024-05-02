import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from './app.module';
import { Observable, catchError, from, map, of, switchMap, tap } from 'rxjs';
import { initialize, reset } from './data/state/actions';
import { isRefreshing, spinningUp } from './data/state/selectors';
import 'zone.js/plugins/zone-patch-rxjs'; // This is required for Angular to work with RxJS
import { BankingConnectorService } from './data/database/banking-connector.service';
import { client } from '@passwordless-id/webauthn';
import { AuthService } from './auth/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  isRefreshing$ = this.store.select(isRefreshing);
  spinningUp$ = this.store.select(spinningUp);
  supportsWebauthn = client.isAvailable();
  authError = false;

  user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : undefined;
  authenticated$ = this.user
    ? of(null).pipe(
      tap(() => console.log('Authenticating user...')),
      switchMap(() => from(client.authenticate(
        [this.user.credential.id],
        this.auth.getLocalChallenge(),
        { authenticatorType: "auto", userVerification: "required", timeout: 60000, debug: false }
      )).pipe(
        switchMap(authentication => this.auth.authenticateUserLocally$(authentication).pipe(
          map(() => {
            console.log('authenticated.');
            return this.user;
          }),
          catchError(() => { this.authError = true; return of(); })
        ))
      ))
    )
    : this.auth.getChallenge$().pipe(
      tap(() => console.log('Registering user...')),
      switchMap(challenge => from(client.register("Spearmint User", challenge, {
        authenticatorType: "auto",
        userVerification: "required",
        timeout: 60000,
        attestation: false,
        debug: false
      })).pipe(
        switchMap(registration => this.auth.registerUser$(registration).pipe(
          map(user => {
            console.log('registered.');
            localStorage.setItem('user', JSON.stringify(user));
            return user;
          }),
        ))
      ))
    )

  // authenticated$ = this.bank.getChallenge$().pipe(
  //     switchMap(challenge => {
  //       const user = JSON.parse(localStorage.getItem('user') || '{}');
  //       if (user.credential) {
  //         console.log('Authenticating user...');
  //         return from(client.authenticate([user.credential.id], challenge, {
  //           authenticatorType: "auto",
  //           userVerification: "required",
  //           timeout: 60000,
  //           debug: false
  //         })).pipe(
  //           switchMap(authentication => this.bank.authenticateUser$(authentication).pipe(
  //             map(() => {
  //               console.log('authenticated.');
  //               return user;
  //             }),
  //             catchError(() => { this.authError = true; return of(); })
  //           ))
  //         );
  //       } else {
  //         console.log('Registering user...');
  //         return from(client.register("Spearmint User", challenge, {
  //           authenticatorType: "auto",
  //           userVerification: "required",
  //           timeout: 60000,
  //           attestation: false,
  //           debug: false
  //         })).pipe(
  //           switchMap(registration => this.bank.registerUser$(registration).pipe(
  //             map(user => {
  //               localStorage.setItem('user', JSON.stringify(user));
  //               return user;
  //             }),
  //           ))
  //         );
  //       }
  //     }),
  //   );

  constructor(private store: Store<AppState>, private bank: BankingConnectorService, private auth: AuthService) { }

  ngOnInit(): void {
    this.store.dispatch(initialize());
  }


}
