import { SocialAuthService } from '@abacritt/angularx-social-login';
import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from '../app.module';
import { loggedIn } from '../state/actions';
import { DatabaseService } from '../state/persistence/database.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {

  constructor(private store: Store<AppState>, private authService: SocialAuthService, private db: DatabaseService) { }

  ngOnInit() {
    this.authService.authState.subscribe((user) => {
      this.store.dispatch(loggedIn(user)),
        console.log('USER', user)
      this.db.getTokens(user.idToken).subscribe()
    });
  }

}
