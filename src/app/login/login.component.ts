import { GoogleLoginProvider, SocialAuthService } from '@abacritt/angularx-social-login';
import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from '../app.module';
import { tap } from 'rxjs';
import { loggedIn, setAccessToken } from '../data/state/actions';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {

  constructor(private authService: SocialAuthService) { }

  ngOnInit() {
    this.authService.signIn(GoogleLoginProvider.PROVIDER_ID);
  }

}
