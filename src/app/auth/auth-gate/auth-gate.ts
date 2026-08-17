import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { AuthService } from '../auth.service';
import { MIN_PASSWORD_LENGTH, PASSWORD_LENGTH_HINT } from '../password-policy';
import { DatabaseService } from '../../data/database.service';

@Component({
  selector: 'app-auth-gate',
  templateUrl: './auth-gate.html',
  styleUrl: './auth-gate.scss',
})
export class AuthGate {
  private readonly authService = inject(AuthService);
  private readonly databaseService = inject(DatabaseService);
  private readonly resetDialog = viewChild<ElementRef<HTMLDialogElement>>('resetDialog');

  readonly stage = this.authService.stage;
  readonly startupError = this.authService.startupError;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  /** True once the migrate stage's mandatory WebAuthn unlock has succeeded — switches
   * that stage from the "Welcome back" prompt to the password-creation form. */
  readonly migrationVerified = signal(false);

  readonly password = signal('');
  readonly passwordConfirm = signal('');

  readonly resetting = signal(false);
  readonly resetError = signal<string | null>(null);

  protected readonly minPasswordLength = MIN_PASSWORD_LENGTH;
  protected readonly passwordHint = PASSWORD_LENGTH_HINT;

  private biometricAttempted = false;

  constructor() {
    // Auto-fires once, right when the steady-state unlock stage loads with biometrics
    // enabled. The password field renders unconditionally alongside this (see the
    // template), so a declined/cancelled/failed prompt never blocks entry — it just
    // leaves the password field there, exactly as if biometrics weren't offered.
    effect(() => {
      if (this.authService.stage() === 'unlock' && this.authService.biometricsEnabled() && !this.biometricAttempted) {
        this.biometricAttempted = true;
        void this.authService.authenticate();
      }
    });
  }

  reload(): void {
    window.location.reload();
  }

  async welcomeBackUnlock(): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      const ok = await this.authService.authenticate();
      if (ok) {
        this.migrationVerified.set(true);
      } else {
        this.error.set("Couldn't verify — please try again.");
      }
    } finally {
      this.busy.set(false);
    }
  }

  async submitCreatePassword(): Promise<void> {
    if (this.password().length < this.minPasswordLength || this.password() !== this.passwordConfirm()) {
      return;
    }
    this.error.set(null);
    this.busy.set(true);
    try {
      await this.authService.createPassword(this.password());
    } catch (err) {
      console.error('Failed to create password:', err);
      this.error.set("Couldn't create a password. Please try again.");
    } finally {
      this.busy.set(false);
    }
  }

  async unlockWithPassword(): Promise<void> {
    if (!this.password()) {
      return;
    }
    this.error.set(null);
    this.busy.set(true);
    try {
      const ok = await this.authService.verifyPassword(this.password());
      if (!ok) {
        this.error.set("Couldn't verify — please try again.");
      }
    } finally {
      this.busy.set(false);
    }
  }

  openResetDialog(): void {
    this.resetError.set(null);
    this.resetDialog()?.nativeElement.showModal();
  }

  closeResetDialog(): void {
    this.resetDialog()?.nativeElement.close();
  }

  /** Wipes local data and, on success, reloads — DatabaseService.resetDatabase() only
   * closes and clears storage, it doesn't reset in-memory app state, and a reload is the
   * simplest way to land back on the fresh-install 'create-password' stage (same reasoning
   * as Settings.confirmReset). Nothing here imports BackupService/crypto-js, so restoring
   * a backup afterward still has to go through Settings once logged back in. */
  async confirmReset(): Promise<void> {
    this.resetting.set(true);
    this.resetError.set(null);
    try {
      await this.databaseService.resetDatabase();
      window.location.reload();
    } catch (err) {
      this.resetError.set(err instanceof Error ? err.message : 'Could not reset local data.');
      this.resetting.set(false);
    }
  }
}
