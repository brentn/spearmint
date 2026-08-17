import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appSettingsMigrationStrategies, appSettingsSchema } from '../data/schemas';
import { DatabaseService } from '../data/database.service';
import type { PasswordHash, WebauthnCredential } from '../data/models';
import { AuthService } from './auth.service';

vi.mock('@passwordless-id/webauthn', () => ({
  client: { register: vi.fn(), authenticate: vi.fn() },
  server: { randomChallenge: vi.fn(() => 'fixed-challenge'), verifyRegistration: vi.fn(), verifyAuthentication: vi.fn() },
}));

import { client, server } from '@passwordless-id/webauthn';

const storedCredential: WebauthnCredential = {
  id: 'cred-1',
  publicKey: 'pk-base64',
  algorithm: 'ES256',
  transports: ['internal'],
};

describe('AuthService', () => {
  let fakeDb: RxDatabase;

  async function seedSettings(overrides: {
    webauthnCredential?: WebauthnCredential | null;
    passwordHash?: PasswordHash | null;
    biometricsEnabled?: boolean;
  }): Promise<void> {
    await fakeDb['appSettings'].upsert({
      id: 'settings',
      lastSyncDate: null,
      webauthnCredential: null,
      passwordHash: null,
      biometricsEnabled: false,
      ignoredExternalAccounts: [],
      exportEncryptionDefault: false,
      ...overrides,
    });
  }

  /** AuthService kicks off its stage lookup in the constructor, so tests that need to
   * seed data first must seed before calling this. */
  function createService(): AuthService {
    return TestBed.inject(AuthService);
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    (server.randomChallenge as ReturnType<typeof vi.fn>).mockReturnValue('fixed-challenge');

    fakeDb = await createRxDatabase({
      name: `auth-test-${Math.random().toString(36).slice(2)}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
    });
    await fakeDb.addCollections({
      appSettings: { schema: appSettingsSchema, migrationStrategies: appSettingsMigrationStrategies },
    });

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: DatabaseService, useValue: { getDatabase: () => Promise.resolve(fakeDb) } },
      ],
    });
  });

  afterEach(async () => {
    await fakeDb.remove();
  });

  describe('startup stage', () => {
    it('lands on create-password for a fresh install (no password, no credential)', async () => {
      const service = createService();

      await vi.waitFor(() => expect(service.stage()).toBe('create-password'));
      expect(service.isUnlocked()).toBe(false);
    });

    it('lands on migrate-set-password when a legacy webauthn credential exists but no password', async () => {
      await seedSettings({ webauthnCredential: storedCredential, biometricsEnabled: true });
      const service = createService();

      await vi.waitFor(() => expect(service.stage()).toBe('migrate-set-password'));
      expect(service.biometricsEnabled()).toBe(true);
    });

    it('lands on unlock once a password exists, even alongside a webauthn credential', async () => {
      await seedSettings({
        webauthnCredential: storedCredential,
        passwordHash: { salt: 's', hash: 'h' },
        biometricsEnabled: true,
      });
      const service = createService();

      await vi.waitFor(() => expect(service.stage()).toBe('unlock'));
    });
  });

  describe('createPassword', () => {
    it('hashes and stores the password, then unlocks', async () => {
      const service = createService();
      await vi.waitFor(() => expect(service.stage()).toBe('create-password'));

      await service.createPassword('a very good password');

      expect(service.stage()).toBe('unlock');
      expect(service.isUnlocked()).toBe(true);
      const doc = await fakeDb['appSettings'].findOne('settings').exec();
      expect(doc?.passwordHash?.hash).toBeTruthy();
      expect(doc?.passwordHash?.salt).toBeTruthy();
    });

    it('patches the existing settings doc rather than replacing it', async () => {
      await fakeDb['appSettings'].upsert({
        id: 'settings',
        lastSyncDate: '2026-08-01',
        webauthnCredential: null,
        passwordHash: null,
        biometricsEnabled: false,
        ignoredExternalAccounts: [{ key: 'conn-1:acct-9', name: 'Old Savings', institutionName: 'My Bank' }],
        exportEncryptionDefault: true,
      });
      const service = createService();
      await vi.waitFor(() => expect(service.stage()).toBe('create-password'));

      await service.createPassword('a very good password');

      const doc = await fakeDb['appSettings'].findOne('settings').exec();
      expect(doc?.lastSyncDate).toBe('2026-08-01');
      expect(doc?.ignoredExternalAccounts).toEqual([
        { key: 'conn-1:acct-9', name: 'Old Savings', institutionName: 'My Bank' },
      ]);
      expect(doc?.exportEncryptionDefault).toBe(true);
    });
  });

  describe('verifyPassword', () => {
    it('unlocks on the correct password', async () => {
      const service = createService();
      await vi.waitFor(() => expect(service.stage()).toBe('create-password'));
      await service.createPassword('a very good password');
      service.lock();

      const result = await service.verifyPassword('a very good password');

      expect(result).toBe(true);
      expect(service.isUnlocked()).toBe(true);
    });

    it('stays locked on the wrong password', async () => {
      const service = createService();
      await vi.waitFor(() => expect(service.stage()).toBe('create-password'));
      await service.createPassword('a very good password');
      service.lock();

      const result = await service.verifyPassword('totally wrong');

      expect(result).toBe(false);
      expect(service.isUnlocked()).toBe(false);
    });

    it('returns false when no password has been set yet', async () => {
      const service = createService();

      const result = await service.verifyPassword('anything');

      expect(result).toBe(false);
      expect(service.isUnlocked()).toBe(false);
    });
  });

  describe('registerBiometrics / disableBiometrics', () => {
    it('registers a credential, persists it, and enables biometrics with no device-label prompt', async () => {
      const service = createService();
      (client.register as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'raw-attestation' });
      (server.verifyRegistration as ReturnType<typeof vi.fn>).mockResolvedValue({ credential: storedCredential });

      await service.registerBiometrics();

      expect(service.biometricsEnabled()).toBe(true);
      const doc = await fakeDb['appSettings'].findOne('settings').exec();
      expect(doc?.webauthnCredential).toEqual(storedCredential);
      expect(doc?.biometricsEnabled).toBe(true);
      expect(client.register).toHaveBeenCalledWith(
        expect.objectContaining({
          challenge: 'fixed-challenge',
          userVerification: 'required',
          customProperties: { authenticatorSelection: { authenticatorAttachment: 'platform' } },
        })
      );
    });

    it('disables biometrics and deletes the stored credential', async () => {
      await seedSettings({ webauthnCredential: storedCredential, biometricsEnabled: true });
      const service = createService();
      await vi.waitFor(() => expect(service.biometricsEnabled()).toBe(true));

      await service.disableBiometrics();

      expect(service.biometricsEnabled()).toBe(false);
      const doc = await fakeDb['appSettings'].findOne('settings').exec();
      expect(doc?.webauthnCredential).toBeNull();
      expect(doc?.biometricsEnabled).toBe(false);
    });
  });

  describe('authenticate', () => {
    it('unlocks in the steady unlock stage on a successful verification', async () => {
      await seedSettings({
        webauthnCredential: storedCredential,
        passwordHash: { salt: 's', hash: 'h' },
        biometricsEnabled: true,
      });
      const service = createService();
      await vi.waitFor(() => expect(service.stage()).toBe('unlock'));
      (client.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ credentialId: 'cred-1' });
      (server.verifyAuthentication as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.authenticate();

      expect(result).toBe(true);
      expect(service.isUnlocked()).toBe(true);
      expect(client.authenticate).toHaveBeenCalledWith(
        expect.objectContaining({ allowCredentials: ['cred-1'], userVerification: 'required' })
      );
    });

    it('verifies but does not unlock in the migrate-set-password stage', async () => {
      await seedSettings({ webauthnCredential: storedCredential, biometricsEnabled: true });
      const service = createService();
      await vi.waitFor(() => expect(service.stage()).toBe('migrate-set-password'));
      (client.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ credentialId: 'cred-1' });
      (server.verifyAuthentication as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.authenticate();

      expect(result).toBe(true);
      expect(service.isUnlocked()).toBe(false);
      expect(service.stage()).toBe('migrate-set-password');
    });

    it('returns false without prompting when no credential is registered', async () => {
      const service = createService();
      await vi.waitFor(() => expect(service.stage()).toBe('create-password'));

      const result = await service.authenticate();

      expect(result).toBe(false);
      expect(client.authenticate).not.toHaveBeenCalled();
    });

    it('stays locked when signature verification fails', async () => {
      await seedSettings({
        webauthnCredential: storedCredential,
        passwordHash: { salt: 's', hash: 'h' },
        biometricsEnabled: true,
      });
      const service = createService();
      await vi.waitFor(() => expect(service.stage()).toBe('unlock'));
      (client.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ credentialId: 'cred-1' });
      (server.verifyAuthentication as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('bad signature'));

      const result = await service.authenticate();

      expect(result).toBe(false);
      expect(service.isUnlocked()).toBe(false);
    });
  });

  it('lock() resets isUnlocked', async () => {
    const service = createService();
    await vi.waitFor(() => expect(service.stage()).toBe('create-password'));
    await service.createPassword('a very good password');
    expect(service.isUnlocked()).toBe(true);

    service.lock();

    expect(service.isUnlocked()).toBe(false);
  });
});
