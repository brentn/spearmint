import { Injectable, inject, signal } from '@angular/core';
import { client, server } from '@passwordless-id/webauthn';
import { getAppSettingsDoc, upsertAppSettings } from '../data/app-settings.util';
import { DatabaseService } from '../data/database.service';
import { hashPassword, verifyPassword as verifyPasswordHash } from './password-hash.util';

export type AuthStage =
  | 'loading'
  | 'error'
  // Fresh install: no password, no legacy WebAuthn credential.
  | 'create-password'
  // Upgraded from a WebAuthn-only install (issue #33): a legacy credential exists but no
  // password yet — the auth-gate makes unlocking via that credential mandatory before it
  // will show the password-creation form, so this stage covers both halves of that flow.
  | 'migrate-set-password'
  // Steady state: a password exists, optionally with biometrics as a faster 2nd step.
  | 'unlock';

/**
 * Password-primary local auth (issue #25): a password is the sole credential required to
 * unlock, created on first run and verified thereafter. WebAuthn (`@passwordless-id/webauthn`,
 * fully client-side — see docs/adr/0003) is kept only as an optional biometric shortcut
 * layered on top, either from a pre-existing security key carried forward by the schema
 * migration (`biometricsEnabled`) or turned on later in Settings. Losing the password with
 * biometrics also off means lockout, recoverable only via the reset-device escape hatch
 * (issue #35) followed by an export/import backup restore, not by this service.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly databaseService = inject(DatabaseService);

  readonly stage = signal<AuthStage>('loading');
  readonly isUnlocked = signal(false);
  readonly startupError = signal<string | null>(null);
  readonly biometricsEnabled = signal(false);

  constructor() {
    void this.loadStage();
  }

  private async getSettingsDoc() {
    const db = await this.databaseService.getDatabase();
    return getAppSettingsDoc(db);
  }

  private async loadStage(): Promise<void> {
    try {
      const settings = await this.getSettingsDoc();
      this.biometricsEnabled.set(!!settings?.biometricsEnabled);
      if (settings?.passwordHash) {
        this.stage.set('unlock');
      } else if (settings?.webauthnCredential) {
        this.stage.set('migrate-set-password');
      } else {
        this.stage.set('create-password');
      }
    } catch (error) {
      // Surface this instead of leaving stage stuck at 'loading' forever: a rejected
      // getDatabase() here previously vanished silently, showing an unexplained
      // infinite spinner with no way for the user to know anything failed.
      console.error('Failed to open the local database:', error);
      this.startupError.set(error instanceof Error ? error.message : 'Could not open the local database.');
      this.stage.set('error');
    }
  }

  /** Sets the unlock password (fresh install, or completing the post-migration mandatory
   * password step) and unlocks. Callers are responsible for length/confirm validation
   * against the shared password-policy module before calling this. */
  async createPassword(password: string): Promise<void> {
    const hash = await hashPassword(password);
    const db = await this.databaseService.getDatabase();
    await upsertAppSettings(db, { passwordHash: hash });
    this.stage.set('unlock');
    this.isUnlocked.set(true);
  }

  async verifyPassword(password: string): Promise<boolean> {
    const settings = await this.getSettingsDoc();
    const stored = settings?.passwordHash;
    if (!stored) {
      return false;
    }
    const ok = await verifyPasswordHash(password, stored);
    if (ok) {
      this.isUnlocked.set(true);
    }
    return ok;
  }

  /** Registers a new WebAuthn credential as the biometric 2nd step. No device-label prompt
   * — used both by the migrate stage's schema-carried-forward credential (already present,
   * this isn't called there) and by Settings' biometrics toggle (issue #34), neither of
   * which collects a label. */
  async registerBiometrics(): Promise<void> {
    const challenge = server.randomChallenge();
    const registrationJson = await client.register({
      user: 'Spearmint',
      challenge,
      userVerification: 'required',
      // `authenticatorAttachment: 'platform'` is a registration-time-only WebAuthn
      // option (it constrains where the key is created, e.g. FaceID/TouchID) —
      // there's no first-class field for it on this library's RegisterOptions,
      // so it's merged in via customProperties into the underlying create() call.
      customProperties: { authenticatorSelection: { authenticatorAttachment: 'platform' } },
    });

    const { credential } = await server.verifyRegistration(registrationJson, {
      challenge,
      origin: window.location.origin,
    });

    const db = await this.databaseService.getDatabase();
    await upsertAppSettings(db, { webauthnCredential: credential, biometricsEnabled: true });
    this.biometricsEnabled.set(true);
  }

  async disableBiometrics(): Promise<void> {
    const db = await this.databaseService.getDatabase();
    await upsertAppSettings(db, { webauthnCredential: null, biometricsEnabled: false });
    this.biometricsEnabled.set(false);
  }

  /** WebAuthn unlock. In the steady 'unlock' stage this is the biometric shortcut and marks
   * the app unlocked on success. In 'migrate-set-password' it's the mandatory first half of
   * that flow — success there deliberately does NOT unlock the app, since a password still
   * has to be set; the auth-gate is responsible for moving to the password-creation form. */
  async authenticate(): Promise<boolean> {
    const settings = await this.getSettingsDoc();
    const credential = settings?.webauthnCredential;
    if (!credential) {
      return false;
    }

    try {
      const challenge = server.randomChallenge();
      const authenticationJson = await client.authenticate({
        challenge,
        allowCredentials: [credential.id],
        userVerification: 'required',
      });
      await server.verifyAuthentication(authenticationJson, credential, {
        challenge,
        origin: window.location.origin,
        userVerified: true,
      });
      if (this.stage() === 'unlock') {
        this.isUnlocked.set(true);
      }
      return true;
    } catch (error) {
      console.error('Local authentication failed:', error);
      return false;
    }
  }

  lock(): void {
    this.isUnlocked.set(false);
  }
}
