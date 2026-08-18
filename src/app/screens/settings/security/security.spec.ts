import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SecurityScreen } from './security';
import { AuthService } from '../../../auth/auth.service';

describe('SecurityScreen', () => {
  let verifyPassword: ReturnType<typeof vi.fn>;
  let createPassword: ReturnType<typeof vi.fn>;
  let registerBiometrics: ReturnType<typeof vi.fn>;
  let disableBiometrics: ReturnType<typeof vi.fn>;
  let biometricsEnabled: ReturnType<typeof signal<boolean>>;

  beforeEach(() => {
    verifyPassword = vi.fn();
    createPassword = vi.fn().mockResolvedValue(undefined);
    registerBiometrics = vi.fn().mockResolvedValue(undefined);
    disableBiometrics = vi.fn().mockResolvedValue(undefined);
    biometricsEnabled = signal(false);

    TestBed.configureTestingModule({
      imports: [SecurityScreen],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { verifyPassword, createPassword, registerBiometrics, disableBiometrics, biometricsEnabled },
        },
      ],
    });
  });

  it('rejects a change when the current password is wrong', async () => {
    verifyPassword.mockResolvedValue(false);
    const fixture = TestBed.createComponent(SecurityScreen);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.currentPassword.set('wrong');
    component.newPassword.set('a very good password');
    component.newPasswordConfirm.set('a very good password');

    await component.changePassword();

    expect(component.passwordError()).toBe('Current password is incorrect.');
    expect(createPassword).not.toHaveBeenCalled();
  });

  it('changes the password once the current password verifies', async () => {
    verifyPassword.mockResolvedValue(true);
    const fixture = TestBed.createComponent(SecurityScreen);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.currentPassword.set('old password');
    component.newPassword.set('a very good password');
    component.newPasswordConfirm.set('a very good password');

    await component.changePassword();

    expect(verifyPassword).toHaveBeenCalledWith('old password');
    expect(createPassword).toHaveBeenCalledWith('a very good password');
    expect(component.passwordChanged()).toBe(true);
    expect(component.currentPassword()).toBe('');
  });

  it('does not attempt a change when the new password is too short', async () => {
    const fixture = TestBed.createComponent(SecurityScreen);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.currentPassword.set('old password');
    component.newPassword.set('short');
    component.newPasswordConfirm.set('short');

    await component.changePassword();

    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it('registers a biometric credential when the toggle is turned on', async () => {
    const fixture = TestBed.createComponent(SecurityScreen);
    fixture.detectChanges();

    await fixture.componentInstance.toggleBiometrics(true);

    expect(registerBiometrics).toHaveBeenCalled();
    expect(disableBiometrics).not.toHaveBeenCalled();
  });

  it('deletes the biometric credential when the toggle is turned off', async () => {
    const fixture = TestBed.createComponent(SecurityScreen);
    fixture.detectChanges();

    await fixture.componentInstance.toggleBiometrics(false);

    expect(disableBiometrics).toHaveBeenCalled();
    expect(registerBiometrics).not.toHaveBeenCalled();
  });

  it('surfaces an error without changing state when registration fails', async () => {
    registerBiometrics.mockRejectedValue(new Error('user cancelled'));
    const fixture = TestBed.createComponent(SecurityScreen);
    fixture.detectChanges();

    await fixture.componentInstance.toggleBiometrics(true);

    expect(fixture.componentInstance.biometricsError()).toBe('user cancelled');
  });

  it('lists Biometrics before Change password, with the biometrics control a switch', () => {
    const fixture = TestBed.createComponent(SecurityScreen);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const titles = Array.from(compiled.querySelectorAll('.security__section-title')).map((el) =>
      el.textContent?.trim(),
    );
    expect(titles).toEqual(['Biometrics', 'Change password']);

    const switchControl = compiled.querySelector('.security__switch input[type="checkbox"]');
    expect(switchControl).toBeTruthy();
  });
});
