import { Component, HostListener } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from './app.module';
import { filter, switchMap, take, tap } from 'rxjs';
import { loggedIn, saveState, setAccessToken } from './data/state/actions';
import { user } from './data/state/selectors';
import { GoogleLoginProvider, SocialAuthService } from '@abacritt/angularx-social-login';

export const ENVIRONMENT = 'sandbox';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  user$ = this.store.select(user);

  constructor(private store: Store<AppState>, private authService: SocialAuthService) { }

  ngOnInit(): void {
    this.authService.authState.pipe(
      tap(user => this.store.dispatch(loggedIn(user))),
      switchMap(() => this.authService.getAccessToken(GoogleLoginProvider.PROVIDER_ID)),
      tap(accessToken => this.store.dispatch(setAccessToken(accessToken)))
    ).subscribe();
  }

  @HostListener('window:beforeunload')
  saveState(): void {
    this.store.select(state => state).pipe(
      take(1),
      filter(state => state.main.accounts.length > 0),
      tap(() => this.store.dispatch(saveState()))
    ).subscribe()
  }

}
