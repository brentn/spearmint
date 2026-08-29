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
  let stage: ReturnType<typeof signal<AuthStage>>;
  let biometricsEnabled: ReturnType<typeof signal<boolean>>;

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
        // AuthGate renders ResetDeviceDialog unconditionally (see the reset-device
        // escape hatch tests below), which injects DatabaseService itself.
        { provide: DatabaseService, useValue: { resetDatabase: vi.fn() } },
      ],
    });
  }

  beforeEach(() => {
    createPassword = vi.fn().mockResolvedValue(undefined);
    verifyPassword = vi.fn().mockResolvedValue(true);
    authenticate = vi.fn().mockResolvedValue(false);
    stage = signal<AuthStage>('create-password');
    biometricsEnabled = signal(false);
  });

  afterEach(() => {
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

  it('auto-fires biometric authentication once when biometrics are enabled, keeping the password field hidden until it resolves', async () => {
    stage.set('unlock');
    biometricsEnabled.set(true);
    configure();
    const fixture = TestBed.createComponent(AuthGate);
    fixture.detectChanges();

    // Hidden while the biometric prompt is in flight — it's the primary path, not a fallback.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input[placeholder="Password"]')).toBeFalsy();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(authenticate).toHaveBeenCalledTimes(1);
    // A declined/failed prompt falls back to the password field rather than blocking entry.
    expect(compiled.querySelector('input[placeholder="Password"]')).toBeTruthy();
  });

  it('keeps the password field hidden when biometrics succeed', async () => {
    stage.set('unlock');
    biometricsEnabled.set(true);
    authenticate.mockResolvedValue(true);
    configure();
    const fixture = TestBed.createComponent(AuthGate);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input[placeholder="Password"]')).toBeFalsy();
  });

  it('does not auto-fire biometrics when disabled, and shows the password field immediately', async () => {
    stage.set('unlock');
    biometricsEnabled.set(false);
    configure();
    const fixture = TestBed.createComponent(AuthGate);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(authenticate).not.toHaveBeenCalled();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input[placeholder="Password"]')).toBeTruthy();
  });

  it('shows the Spearmint logo', () => {
    stage.set('unlock');
    configure();
    const fixture = TestBed.createComponent(AuthGate);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('img.auth-gate__logo')).toBeTruthy();
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
    // The dialog's own open/confirm/error behavior is covered by
    // ResetDeviceDialog's own spec — these only check that AuthGate wires it in
    // the right stages, tucked away rather than shown up-front. Deliberately
    // doesn't click the trigger: jsdom doesn't implement HTMLDialogElement.showModal().

    it('is not visible at a first glance — tucked behind a disclosure', () => {
      stage.set('unlock');
      configure();
      const fixture = TestBed.createComponent(AuthGate);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;

      const details = compiled.querySelector('details.auth-gate__trouble');
      expect(details).toBeTruthy();
      expect(details?.hasAttribute('open')).toBe(false);
      expect(compiled.querySelector('app-reset-device-dialog')).toBeTruthy();
    });

    it('offers the escape hatch in the migrate stage before WebAuthn verification', () => {
      stage.set('migrate-set-password');
      configure();
      const fixture = TestBed.createComponent(AuthGate);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.querySelector('details.auth-gate__trouble')).toBeTruthy();
    });

    it('does not offer the escape hatch on a true fresh install — nothing to reset yet', () => {
      stage.set('create-password');
      configure();
      const fixture = TestBed.createComponent(AuthGate);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;

      expect(compiled.querySelector('details.auth-gate__trouble')).toBeFalsy();
    });
  });
});
