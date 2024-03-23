import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { AppState } from 'src/app/app.module';
import { accessToken } from 'src/app/data/state/selectors';

@Injectable({
  providedIn: 'root'
})
export class TokenInterceptorService implements HttpInterceptor {
  accessToken: string | undefined;

  constructor(private store: Store<AppState>) {
    this.store.select(accessToken).subscribe(token => this.accessToken = token);
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.accessToken) {
      req = req.clone({ setHeaders: { Authorization: `Bearer ${this.accessToken}` } });
    }
    return next.handle(req);
  }
}
