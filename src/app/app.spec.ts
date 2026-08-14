import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { App } from './app';
import { AuthService, type CredentialStatus } from './auth/auth.service';
import { routes } from './app.routes';

function configureWithAuth(overrides: Partial<Pick<AuthService, 'isUnlocked' | 'credentialStatus'>>) {
  TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter(routes),
      {
        provide: AuthService,
        useValue: {
          isUnlocked: signal(false),
          credentialStatus: signal<CredentialStatus>('absent'),
          ...overrides,
        },
      },
    ],
  });
}

describe('App', () => {
  it('shows the auth gate, not the nav shell, while locked', async () => {
    configureWithAuth({ isUnlocked: signal(false), credentialStatus: signal('absent') });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-auth-gate')).toBeTruthy();
    expect(compiled.querySelector('app-nav-shell')).toBeFalsy();
  });

  it('shows the nav shell and router outlet once unlocked', async () => {
    configureWithAuth({ isUnlocked: signal(true), credentialStatus: signal('present') });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-nav-shell')).toBeTruthy();
    expect(compiled.querySelector('app-auth-gate')).toBeFalsy();
  });
});
