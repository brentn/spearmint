import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/app.module';
import { plaidConfig } from '../state/selectors';
import { Observable, map, switchMap } from 'rxjs';
import { ENVIRONMENT } from 'src/app/app.component';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {

  constructor(private http: HttpClient, private store: Store<AppState>) { }

  exchangePublicToken$(publicToken: string): Observable<string> {
    const headers = new HttpHeaders().append('Content-Type', 'application/json');
    return this.store.select(plaidConfig).pipe(
      switchMap(config => this.http.post('https://' + ENVIRONMENT + '.plaid.com/item/public_token/exchange', {
        public_token: publicToken,
        client_id: config.clientId,
        secret: config.secret
      }, { headers }).pipe(
        map((response: any) => response.access_token)
      ))
    )
  }

}
