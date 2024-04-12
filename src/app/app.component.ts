import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from './app.module';
import { from, tap } from 'rxjs';
import { initialize, loggedIn } from './data/state/actions';
import { isRefreshing } from './data/state/selectors';
import 'zone.js/plugins/zone-patch-rxjs'; // This is required for Angular to work with RxJS
import * as passwordless from '@passwordless-id/connect/dist/connect.min.js';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  isRefreshing$ = this.store.select(isRefreshing);
  user$ = from(passwordless.id({ scope: 'openid' })).pipe(
    tap((user: any) => {
      if (user.signedIn && user.scopeGranted) {
        this.store.dispatch(loggedIn({ idToken: user.id_token }))
      } else {
        passwordless.auth({ scope: 'openid' });
      }
    })
  );

  constructor(private store: Store<AppState>) { }

  ngOnInit(): void {
    this.store.dispatch(initialize());
  }
}
