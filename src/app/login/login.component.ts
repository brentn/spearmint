import { SocialAuthService } from '@abacritt/angularx-social-login';
import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from '../app.module';
import { tap } from 'rxjs';
import { loggedIn } from '../data/state/actions';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {

  constructor(private store: Store<AppState>, private authService: SocialAuthService) { }

  ngOnInit() {
    this.authService.authState.pipe(
      tap(user => this.store.dispatch(loggedIn(user))),
    ).subscribe();
  }

}
