import { Injectable, inject, signal } from '@angular/core';
import { client, server } from '@passwordless-id/webauthn';
import { DatabaseService } from '../data/database.service';
import type { AppSettings, WebauthnCredential } from '../data/models';

export type CredentialStatus = 'loading' | 'present' | 'absent';

const DEFAULT_SETTINGS: Omit<AppSettings, 'webauthnCredential'> = {
  id: 'settings',
  lastSyncDate: null,
  ignoredExternalAccounts: [],
  exportEncryptionDefault: false,
};

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

  constructor() {
    void this.loadCredentialStatus();
  }

  private async getSettingsDoc() {
    const db = await this.databaseService.getDatabase();
    return db.appSettings.findOne('settings').exec();
  }

  private async loadCredentialStatus(): Promise<void> {
    const settings = await this.getSettingsDoc();
    this.credentialStatus.set(settings?.webauthnCredential ? 'present' : 'absent');
  }

  private async saveCredential(credential: WebauthnCredential): Promise<void> {
    const existing = await this.getSettingsDoc();
    if (existing) {
      await existing.incrementalPatch({ webauthnCredential: credential });
      return;
    }
    const db = await this.databaseService.getDatabase();
    await db.appSettings.insert({ ...DEFAULT_SETTINGS, webauthnCredential: credential });
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
