import { GoogleLoginProvider, SocialAuthService } from '@abacritt/angularx-social-login';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, filter, from, map, switchMap, take, tap } from 'rxjs';
import { AppState } from 'src/app/app.module';
import { user } from 'src/app/data/state/selectors';

@Injectable({
  providedIn: 'root'
})
export class TokenInterceptorService implements HttpInterceptor {
  idToken: string | undefined;

  constructor(private store: Store<AppState>, private authService: SocialAuthService) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.idToken) {
      req = req.clone({ setHeaders: { Authorization: `Bearer ${this.idToken}` } });
      return next.handle(req);
    } else {
      return this.store.select(user).pipe(
        filter(user => !!user),
        take(1),
        tap(user => this.idToken = user!.idToken),
        switchMap(() => {
          req = req.clone({ setHeaders: { Authorization: `Bearer ${this.idToken}` } });
          return next.handle(req);
        })
      );
    }
  }
}
