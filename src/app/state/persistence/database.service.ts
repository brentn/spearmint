import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

const API = 'https://spearmint-imnj.onrender.com/';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {

  constructor(private http: HttpClient) { }

  getTokens(authorizationToken: string): Observable<void> {
    const headers = { headers: new HttpHeaders().set('Authoriztion', `Bearer ${authorizationToken}`) };
    return this.http.post(API + '/auth', headers).pipe(
      tap(response => console.log('RESPONSE', response)),
      map(() => void (0))
    )
  }
}
