import { GoogleLoginProvider, SocialAuthService } from '@abacritt/angularx-social-login';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, from, map, switchMap, tap } from 'rxjs';
import { AppState } from 'src/app/app.module';

@Injectable({
  providedIn: 'root'
})
export class TokenInterceptorService implements HttpInterceptor {
  accessToken: string | undefined;

  constructor(private authService: SocialAuthService) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.accessToken) {
      req = req.clone({ setHeaders: { Authorization: `Bearer ${this.accessToken}` } });
      return next.handle(req);
    } else {
      return from(this.authService.getAccessToken(GoogleLoginProvider.PROVIDER_ID)).pipe(
        tap(accessToken => this.accessToken = accessToken),
        switchMap(() => {
          req = req.clone({ setHeaders: { Authorization: `Bearer ${this.accessToken}` } });
          return next.handle(req);
        })
      );
    }
  }
}
