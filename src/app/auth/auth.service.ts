import { Injectable, inject, signal } from '@angular/core';
import { client, server } from '@passwordless-id/webauthn';
import { getAppSettingsDoc, upsertAppSettings } from '../data/app-settings.util';
import { DatabaseService } from '../data/database.service';
import type { WebauthnCredential } from '../data/models';

export type CredentialStatus = 'loading' | 'present' | 'absent' | 'error';

/**
 * Fully local WebAuthn auth: registration and authentication both run
 * client-side (client.* triggers the platform authenticator, server.*
 * verifies the signature — both run in-browser here, no network round trip).
 * The credential is the only thing persisted; losing it means lockout,
 * recoverable only via export/import (a later ticket), not by this service.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly databaseService = inject(DatabaseService);

  readonly credentialStatus = signal<CredentialStatus>('loading');
  readonly isUnlocked = signal(false);
  readonly startupError = signal<string | null>(null);

  constructor() {
    void this.loadCredentialStatus();
  }

  private async getSettingsDoc() {
    const db = await this.databaseService.getDatabase();
    return getAppSettingsDoc(db);
  }

  private async loadCredentialStatus(): Promise<void> {
    try {
      const settings = await this.getSettingsDoc();
      this.credentialStatus.set(settings?.webauthnCredential ? 'present' : 'absent');
    } catch (error) {
      // Surface this instead of leaving credentialStatus stuck at 'loading' forever:
      // a rejected getDatabase() here previously vanished silently, showing an
      // unexplained infinite spinner with no way for the user to know anything failed.
      console.error('Failed to open the local database:', error);
      this.startupError.set(error instanceof Error ? error.message : 'Could not open the local database.');
      this.credentialStatus.set('error');
    }
  }

  private async saveCredential(credential: WebauthnCredential): Promise<void> {
    const db = await this.databaseService.getDatabase();
    await upsertAppSettings(db, { webauthnCredential: credential });
  }

  async register(deviceLabel: string): Promise<void> {
    const challenge = server.randomChallenge();
    const registrationJson = await client.register({
      user: deviceLabel,
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

    await this.saveCredential(credential);
    this.credentialStatus.set('present');
    this.isUnlocked.set(true);
  }

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
      this.isUnlocked.set(true);
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
