import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGate } from './auth-gate';
import { AuthService, type AuthStage } from '../auth.service';
import { DatabaseService } from '../../data/database.service';

describe('AuthGate', () => {
  let createPassword: ReturnType<typeof vi.fn>;
  let verifyPassword: ReturnType<typeof vi.fn>;
  let authenticate: ReturnType<typeof vi.fn>;
  let resetDatabase: ReturnType<typeof vi.fn>;
  let stage: ReturnType<typeof signal<AuthStage>>;
  let biometricsEnabled: ReturnType<typeof signal<boolean>>;
  let reloadMock: ReturnType<typeof vi.fn>;
  const originalLocation = window.location;

  function configure(): void {
    TestBed.configureTestingModule({
      imports: [AuthGate],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: AuthService,
          useValue: {
            stage,
            biometricsEnabled,
            startupError: signal<string | null>(null),
            isUnlocked: signal(false),
            createPassword,
            verifyPassword,
            authenticate,
          },
        },
        { provide: DatabaseService, useValue: { resetDatabase } },
      ],
    });
  }

  beforeEach(() => {
    createPassword = vi.fn().mockResolvedValue(undefined);
    verifyPassword = vi.fn().mockResolvedValue(true);
    authenticate = vi.fn().mockResolvedValue(false);
    resetDatabase = vi.fn().mockResolvedValue(undefined);
    stage = signal<AuthStage>('create-password');
    biometricsEnabled = signal(false);

    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload: reloadMock },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
    vi.restoreAllMocks();
  });

  function setInputValue(element: HTMLElement, selector: string, value: string): void {
    const input = element.querySelector<HTMLInputElement>(selector);
    if (!input) {
      throw new Error(`missing input: ${selector}`);
    }
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('rejects creating a password shorter than the minimum', async () => {
    configure();
    const fixture = TestBed.createComponent(AuthGate);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    setInputValue(compiled, 'input[placeholder="Password"]', 'short');
    setInputValue(compiled, 'input[placeholder="Confirm password"]', 'short');
    fixture.detectChanges();

    const button = compiled.querySelector<HTMLButtonElement>('.auth-gate__button');
    expect(button?.disabled).toBe(true);
    expect(createPassword).not.toHaveBeenCalled();
  });

  it('creates a password once it meets the minimum length and matches its confirmation', async () => {
    configure();
    const fixture = TestBed.createComponent(AuthGate);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    setInputValue(compiled, 'input[placeholder="Password"]', 'a very good password');
    setInputValue(compiled, 'input[placeholder="Confirm password"]', 'a very good password');
    fixture.detectChanges();

    compiled.querySelector<HTMLButtonElement>('.auth-gate__button')?.click();
    await fixture.whenStable();

    expect(createPassword).toHaveBeenCalledWith('a very good password');
  });

  it('steady-state unlock stage verifies the entered password', async () => {
    stage.set('unlock');
    configure();
    const fixture = TestBed.createComponent(AuthGate);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    setInputValue(compiled, 'input[placeholder="Password"]', 'my password');
    fixture.detectChanges();
    compiled.querySelector<HTMLButtonElement>('.auth-gate__button')?.click();
    await fixture.whenStable();

    expect(verifyPassword).toHaveBeenCalledWith('my password');
  });

  it('auto-fires biometric authentication once when biometrics are enabled in the unlock stage', async () => {
    stage.set('unlock');
    biometricsEnabled.set(true);
    configure();
    const fixture = TestBed.createComponent(AuthGate);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(authenticate).toHaveBeenCalledTimes(1);
    // A declined/failed prompt must not block the password field.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input[placeholder="Password"]')).toBeTruthy();
  });

  it('does not auto-fire biometrics when disabled', async () => {
    stage.set('unlock');
    biometricsEnabled.set(false);
    configure();
    const fixture = TestBed.createComponent(AuthGate);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(authenticate).not.toHaveBeenCalled();
  });

  it('migrate stage shows the WebAuthn "Welcome back" unlock before a password can be created', async () => {
    stage.set('migrate-set-password');
    configure();
    const fixture = TestBed.createComponent(AuthGate);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('input[placeholder="Password"]')).toBeFalsy();
    expect(compiled.textContent).toContain('Welcome back');
  });

  it('migrate stage reveals the password-creation form once WebAuthn unlock succeeds', async () => {
    stage.set('migrate-set-password');
    authenticate.mockResolvedValue(true);
    configure();
    const fixture = TestBed.createComponent(AuthGate);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelector<HTMLButtonElement>('.auth-gate__button')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(compiled.querySelector('input[placeholder="Password"]')).toBeTruthy();
  });

  describe('reset-device escape hatch', () => {
    it('is not visible at a first glance — tucked behind a disclosure', () => {
      stage.set('unlock');
      configure();
      const fixture = TestBed.createComponent(AuthGate);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;

      const details = compiled.querySelector('details.auth-gate__trouble');
      expect(details).toBeTruthy();
      expect(details?.hasAttribute('open')).toBe(false);
    });

    it('wipes local data and reloads on confirm', async () => {
      stage.set('unlock');
      configure();
      const fixture = TestBed.createComponent(AuthGate);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;

      compiled.querySelector<HTMLButtonElement>('.auth-gate__reset-link')?.click();
      await fixture.componentInstance.confirmReset();

      expect(resetDatabase).toHaveBeenCalled();
      expect(reloadMock).toHaveBeenCalled();
    });

    it('surfaces an error and does not reload when the reset fails', async () => {
      resetDatabase.mockRejectedValue(new Error('storage unavailable'));
      stage.set('unlock');
      configure();
      const fixture = TestBed.createComponent(AuthGate);
      fixture.detectChanges();

      await fixture.componentInstance.confirmReset();

      expect(fixture.componentInstance.resetError()).toBe('storage unavailable');
      expect(reloadMock).not.toHaveBeenCalled();
    });

    it('offers the escape hatch in the migrate stage before WebAuthn verification', () => {
      stage.set('migrate-set-password');
      configure();
      const fixture = TestBed.createComponent(AuthGate);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.querySelector('details.auth-gate__trouble')).toBeTruthy();
    });
  });
});
