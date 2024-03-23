import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/app.module';
import { Observable, map } from 'rxjs';
import { ENVIRONMENT } from 'src/app/app.component';

const API = 'https://spearmint-imnj.onrender.com';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  headers = { headers: new HttpHeaders().set('Content-Type', 'application/json') };


  constructor(private http: HttpClient, private store: Store<AppState>) { }

  getLinkToken$(): Observable<string> {
    return this.http.post(`${API}/linkToken`, null, this.headers).pipe(
      map((response: any) => response.link_token)
    )
  }

  exchangePublicToken(publicToken: string): Observable<{ accessToken: string, itemId: string }> {
    return this.http.post(`${API}/accessToken`, {
      public_token: publicToken,
    }, this.headers).pipe(
      map((response: any) => ({ accessToken: response.access_token, itemId: response.item_id }))
    )
  }

}
