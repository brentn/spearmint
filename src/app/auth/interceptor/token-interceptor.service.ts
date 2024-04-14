import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TokenInterceptorService implements HttpInterceptor {
  idToken: string | undefined;

  constructor() { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.idToken) {
      req = req.clone({ setHeaders: { Authorization: `Bearer ${this.idToken}` } });
      return next.handle(req);
    } else {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.credential) {
        this.idToken = user.credential.id;
        req = req.clone({ setHeaders: { Authorization: `Bearer ${this.idToken}` } });
      }
      return next.handle(req);
    }
  }
}
