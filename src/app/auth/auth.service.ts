import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, from, map, of } from 'rxjs';
import { server as webauthn } from '@passwordless-id/webauthn';

const API = 'https://spearmint-imnj.onrender.com';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  headers = { headers: new HttpHeaders().set('Content-Type', 'application/json') };
  challenge: string | undefined;

  constructor(private http: HttpClient) { }

  getChallenge$(): Observable<string> {
    return this.http.get(`${API}/challenge`).pipe(
      map((response: any) => response.challenge)
    )
  }

  registerUser$(registration: { username: string, credential: { id: string, publicKey: string, algorithm: string } }): Observable<object> {
    return this.http.post(`${API}/register`, registration, this.headers).pipe(
      map((verifiedRegistration: any) => {
        localStorage.setItem('credential', JSON.stringify(verifiedRegistration.credential));
        return verifiedRegistration;
      })
    )
  }

  authenticateUser$(authentication: { credentialId: string, authenticatorData: string, clientData: string, signature: string }): Observable<void> {
    return this.http.post(`${API}/authenticate`, authentication, this.headers).pipe(
      map(() => void (0))
    )
  }

  getLocalChallenge(): string {
    this.challenge = crypto.randomUUID();
    return this.challenge;
  }

  authenticateUserLocally$(authentication: { credentialId: string, authenticatorData: string, clientData: string, signature: string }): Observable<void> {
    try {
      const credential = JSON.parse(localStorage.getItem('credential') || '{}');
      if (!credential) { throw new Error('Credential not found'); };
      const challenge = this.challenge!;
      return from(webauthn.verifyAuthentication(authentication, credential, {
        challenge,
        origin: (origin: string) => true,
        userVerified: true,
        verbose: false
      })).pipe(map(() => void (0)));
    } catch (error) {
      console.error('Error authenticating user locally:', error);
      return of(void (0));
    }
  }

  resetCredentials$(): Observable<void> {
    return this.http.post(`${API}/resetCredentials`, null, this.headers).pipe(
      map(() => void (0))
    )
  };
}
