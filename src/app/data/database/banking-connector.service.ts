import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { BalanceDTO } from '../types/balanceDTO';
import { TransactionsDTO } from '../types/transactionsDTO';

const API = 'https://spearmint-imnj.onrender.com';
// const API = 'http://localhost:4000';

@Injectable({
  providedIn: 'root'
})
export class BankingConnectorService {
  headers = { headers: new HttpHeaders().set('Content-Type', 'application/json') };


  constructor(private http: HttpClient) { }

  spinUpServer$(): Observable<void> {
    return this.http.get(`${API}/status`).pipe(
      map(() => void (0))
    );
  }

  getChallenge$(): Observable<string> {
    return this.http.get(`${API}/challenge`).pipe(
      map((response: any) => response.challenge)
    )
  }

  registerUser$(registration: { username: string, credential: { id: string, publicKey: string, algorithm: string } }): Observable<object> {
    return this.http.post(`${API}/register`, registration, this.headers).pipe(
      map(obj => obj)
    )
  }

  authenticateUser$(authentication: { credentialId: string, authenticatorData: string, clientData: string, signature: string }): Observable<void> {
    return this.http.post(`${API}/authenticate`, authentication, this.headers).pipe(
      map(() => void (0))
    )
  }

  resetCredentials$(): Observable<void> {
    return this.http.post(`${API}/resetCredentials`, null, this.headers).pipe(
      map(() => void (0))
    )
  };

  getLinkToken$(): Observable<string> {
    return this.http.post(`${API}/linkToken`, null, this.headers).pipe(
      map((response: any) => response.link_token)
    )
  }

  updateLinkToken$(accessToken: string): Observable<string> {
    return this.http.put(`${API}/linkToken`, { accessToken }, this.headers).pipe(
      map((response: any) => response.link_token)
    )
  }

  exchangePublicToken$(publicToken: string): Observable<{ accessToken: string, itemId: string }> {
    return this.http.post(`${API}/accessToken`, {
      public_token: publicToken,
    }, this.headers).pipe(
      map((response: any) => ({ accessToken: response.access_token, itemId: response.item_id }))
    )
  }

  accountBalances$(accessToken: string): Observable<BalanceDTO[]> {
    return this.http.post(`${API}/balances`, { access_token: accessToken }, this.headers).pipe(
      map((dto: any) => dto.accounts),
    )
  }

  transactions$(params: { accessToken: string, cursor: string | undefined }): Observable<TransactionsDTO> {
    return this.http.post(`${API}/transactions`, { access_token: params.accessToken, cursor: params.cursor }, this.headers).pipe(
      map((dto: any) => dto.transactions),
      catchError((error: HttpErrorResponse) => {
        switch (error.status) {
          case 401: console.log('401'); break;
        }
        return of();
      })
    )
  }

}
