import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

const API = 'https://spearmint-imnj.onrender.com';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  headers = { headers: new HttpHeaders().set('Content-Type', 'application/json') };


  constructor(private http: HttpClient) { }

  spinUpServer$(): Observable<void> {
    return this.http.get(`${API}/status`).pipe(
      map(() => void (0))
    );
  }

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
