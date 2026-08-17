import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { AuthService, type AuthStage } from './auth/auth.service';
import { IdleLockService } from './auth/idle-lock.service';
import { routes } from './app.routes';
import { SimplefinSyncService } from './simplefin/simplefin-sync.service';

class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  // jsdom doesn't implement ResizeObserver; NavShell (rendered once unlocked) needs one.
  vi.stubGlobal('ResizeObserver', NoopResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function configureWithAuth(overrides: Partial<Pick<AuthService, 'isUnlocked' | 'stage'>>) {
  const idleLockService = { start: vi.fn(), stop: vi.fn() };
  TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter(routes),
      {
        provide: AuthService,
        useValue: {
          isUnlocked: signal(false),
          stage: signal<AuthStage>('create-password'),
          biometricsEnabled: signal(false),
          startupError: signal<string | null>(null),
          ...overrides,
        },
      },
      { provide: IdleLockService, useValue: idleLockService },
      {
        provide: SimplefinSyncService,
        useValue: { runAutoSyncIfDue: vi.fn().mockResolvedValue(undefined) },
      },
    ],
  });
  return idleLockService;
}

describe('App', () => {
  it('shows the auth gate, not the nav shell, while locked', async () => {
    configureWithAuth({ isUnlocked: signal(false), stage: signal('create-password') });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-auth-gate')).toBeTruthy();
    expect(compiled.querySelector('app-nav-shell')).toBeFalsy();
  });

  it('shows the nav shell and router outlet once unlocked', async () => {
    configureWithAuth({ isUnlocked: signal(true), stage: signal('unlock') });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-nav-shell')).toBeTruthy();
    expect(compiled.querySelector('app-auth-gate')).toBeFalsy();
  });

  it('triggers an auto-sync check and starts idle-lock tracking once unlocked, but not while locked', async () => {
    const idleLockService = configureWithAuth({ isUnlocked: signal(false), stage: signal('create-password') });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const syncService = TestBed.inject(SimplefinSyncService);
    expect(syncService.runAutoSyncIfDue).not.toHaveBeenCalled();
    expect(idleLockService.start).not.toHaveBeenCalled();
    expect(idleLockService.stop).toHaveBeenCalled();

    fixture.componentInstance['authService'].isUnlocked.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(syncService.runAutoSyncIfDue).toHaveBeenCalled();
    expect(idleLockService.start).toHaveBeenCalled();
  });
});
