import { ChangeDetectorRef, Component, HostListener } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from './app.module';
import { filter, take, tap } from 'rxjs';
import { loggedIn, saveState } from './data/state/actions';
import { accounts, user } from './data/state/selectors';
import { SocialAuthService } from '@abacritt/angularx-social-login';

export const ENVIRONMENT = 'sandbox';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  user$ = this.store.select(user);

  constructor(private store: Store<AppState>, private authService: SocialAuthService, private cd: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.authService.authState.pipe(
      tap(user => this.store.dispatch(loggedIn(user))),
    ).subscribe();
    this.refreshAfterStateRestored();
  }

  @HostListener('window:beforeunload')
  saveState(): void {
    this.store.select(state => state).pipe(
      take(1),
      filter(state => state.main.accounts.length > 0),
      tap(() => this.store.dispatch(saveState()))
    ).subscribe()
  }

  private refreshAfterStateRestored(): void {
    this.store.select(accounts).pipe(
      take(1),
      tap(() => this.cd.detectChanges())
    ).subscribe();

  }
}
