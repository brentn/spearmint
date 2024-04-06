import { Component, HostListener } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from './app.module';
import { filter, take, tap } from 'rxjs';
import { initialize, loggedIn, saveState } from './data/state/actions';
import { isRefreshing, user } from './data/state/selectors';
import { SocialAuthService } from '@abacritt/angularx-social-login';
import { DBStateService } from './data/state/dbState.service';

import 'zone.js/plugins/zone-patch-rxjs'; // This is required for Angular to work with RxJS

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  user$ = this.store.select(user);
  isRefreshing$ = this.store.select(isRefreshing);


  constructor(private store: Store<AppState>, private authService: SocialAuthService, private dbState: DBStateService) { }

  ngOnInit(): void {
    this.store.dispatch(initialize());
    this.authService.authState.pipe(
      filter(user => !!user),
      tap(user => this.store.dispatch(loggedIn(user))),
    ).subscribe();
  }

  @HostListener('window:beforeunload')
  saveState(): void {
    this.store.select(state => state).pipe(
      take(1),
      filter(state => !!state.main.user),
      tap(() => this.store.dispatch(saveState()))
    ).subscribe()
  }

}
