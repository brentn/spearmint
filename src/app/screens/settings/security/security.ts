import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../../auth/auth.service';
import { MIN_PASSWORD_LENGTH, PASSWORD_LENGTH_HINT } from '../../../auth/password-policy';
import { SettingsHeader } from '../settings-header/settings-header';

@Component({
  selector: 'app-security',
  imports: [SettingsHeader],
  templateUrl: './security.html',
  styleUrl: './security.scss',
})
export class SecurityScreen {
  private readonly authService = inject(AuthService);

  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  protected readonly passwordHint = PASSWORD_LENGTH_HINT;
  protected readonly biometricsEnabled = this.authService.biometricsEnabled;

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly newPasswordConfirm = signal('');
  readonly changingPassword = signal(false);
  readonly passwordError = signal<string | null>(null);
  readonly passwordChanged = signal(false);

  readonly biometricsBusy = signal(false);
  readonly biometricsError = signal<string | null>(null);

  async changePassword(): Promise<void> {
    this.passwordError.set(null);
    this.passwordChanged.set(false);
    if (this.newPassword().length < this.minPasswordLength || this.newPassword() !== this.newPasswordConfirm()) {
      return;
    }
    this.changingPassword.set(true);
    try {
      const currentOk = await this.authService.verifyPassword(this.currentPassword());
      if (!currentOk) {
        this.passwordError.set('Current password is incorrect.');
        return;
      }
      await this.authService.createPassword(this.newPassword());
      this.currentPassword.set('');
      this.newPassword.set('');
      this.newPasswordConfirm.set('');
      this.passwordChanged.set(true);
    } catch (err) {
      this.passwordError.set(err instanceof Error ? err.message : 'Could not change the password.');
    } finally {
      this.changingPassword.set(false);
    }
  }

  async toggleBiometrics(enabled: boolean): Promise<void> {
    this.biometricsError.set(null);
    this.biometricsBusy.set(true);
    try {
      if (enabled) {
        await this.authService.registerBiometrics();
      } else {
        await this.authService.disableBiometrics();
      }
    } catch (err) {
      this.biometricsError.set(err instanceof Error ? err.message : 'Could not update biometrics.');
    } finally {
      this.biometricsBusy.set(false);
    }
  }
}
