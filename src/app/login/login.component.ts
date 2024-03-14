import { SocialAuthService } from '@abacritt/angularx-social-login';
import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from '../app.module';
import { switchMap, tap, withLatestFrom } from 'rxjs';
import { loggedIn } from '../data/state/actions';
import { configuration } from '../data/state/selectors';
import { DatabaseService } from '../data/database/database.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {

  constructor(private store: Store<AppState>, private authService: SocialAuthService, private db: DatabaseService) { }

  ngOnInit() {
    this.authService.authState.pipe(
      tap(user => this.store.dispatch(loggedIn(user))),
      withLatestFrom(this.store.select(configuration)),
      // switchMap(([user, config]) => this.db.getToken(user, config.plaid)),
      // tap(a => console.log('HERE', a))
    ).subscribe();
  }

}
