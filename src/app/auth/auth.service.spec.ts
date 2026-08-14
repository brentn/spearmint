import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appSettingsMigrationStrategies, appSettingsSchema } from '../data/schemas';
import { DatabaseService } from '../data/database.service';
import type { WebauthnCredential } from '../data/models';
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

  async function seedSettings(credential: WebauthnCredential | null): Promise<void> {
    await fakeDb['appSettings'].upsert({
      id: 'settings',
      lastSyncDate: null,
      webauthnCredential: credential,
      ignoredExternalAccounts: [],
      exportEncryptionDefault: false,
    });
  }

  /** AuthService kicks off its credential lookup in the constructor, so tests that
   * need to seed data first must seed before calling this. */
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

  it('reports no credential once the initial lookup resolves', async () => {
    const service = createService();

    await vi.waitFor(() => expect(service.credentialStatus()).toBe('absent'));
    expect(service.isUnlocked()).toBe(false);
  });

  it('reports a present credential once the initial lookup resolves', async () => {
    await seedSettings(storedCredential);
    const service = createService();

    await vi.waitFor(() => expect(service.credentialStatus()).toBe('present'));
  });

  it('registers a new credential, persists it, and unlocks', async () => {
    const service = createService();
    (client.register as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'raw-attestation' });
    (server.verifyRegistration as ReturnType<typeof vi.fn>).mockResolvedValue({
      credential: storedCredential,
    });

    await service.register("Brent's iPhone");

    expect(service.credentialStatus()).toBe('present');
    expect(service.isUnlocked()).toBe(true);
    const doc = await fakeDb['appSettings'].findOne('settings').exec();
    expect(doc?.webauthnCredential).toEqual(storedCredential);
    expect(client.register).toHaveBeenCalledWith(
      expect.objectContaining({
        user: "Brent's iPhone",
        challenge: 'fixed-challenge',
        userVerification: 'required',
        customProperties: { authenticatorSelection: { authenticatorAttachment: 'platform' } },
      })
    );
  });

  it('re-registering patches the existing settings doc rather than replacing it', async () => {
    await fakeDb['appSettings'].upsert({
      id: 'settings',
      lastSyncDate: '2026-08-01',
      webauthnCredential: null,
      ignoredExternalAccounts: [{ key: 'conn-1:acct-9', name: 'Old Savings', institutionName: 'My Bank' }],
      exportEncryptionDefault: true,
    });
    const service = createService();
    (client.register as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'raw-attestation' });
    (server.verifyRegistration as ReturnType<typeof vi.fn>).mockResolvedValue({
      credential: storedCredential,
    });

    await service.register('New device');

    const doc = await fakeDb['appSettings'].findOne('settings').exec();
    expect(doc?.webauthnCredential).toEqual(storedCredential);
    expect(doc?.lastSyncDate).toBe('2026-08-01');
    expect(doc?.ignoredExternalAccounts).toEqual([
      { key: 'conn-1:acct-9', name: 'Old Savings', institutionName: 'My Bank' },
    ]);
    expect(doc?.exportEncryptionDefault).toBe(true);
  });

  it('authenticates successfully against a previously stored credential', async () => {
    await seedSettings(storedCredential);
    const service = createService();
    (client.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ credentialId: 'cred-1' });
    (server.verifyAuthentication as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await service.authenticate();

    expect(result).toBe(true);
    expect(service.isUnlocked()).toBe(true);
    expect(client.authenticate).toHaveBeenCalledWith(
      expect.objectContaining({ allowCredentials: ['cred-1'], userVerification: 'required' })
    );
  });

  it('returns false without prompting when no credential is registered', async () => {
    const service = createService();

    const result = await service.authenticate();

    expect(result).toBe(false);
    expect(client.authenticate).not.toHaveBeenCalled();
  });

  it('stays locked when signature verification fails', async () => {
    await seedSettings(storedCredential);
    const service = createService();
    (client.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ credentialId: 'cred-1' });
    (server.verifyAuthentication as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('bad signature'));

    const result = await service.authenticate();

    expect(result).toBe(false);
    expect(service.isUnlocked()).toBe(false);
  });

  it('lock() resets isUnlocked', async () => {
    const service = createService();
    (client.register as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'raw-attestation' });
    (server.verifyRegistration as ReturnType<typeof vi.fn>).mockResolvedValue({
      credential: storedCredential,
    });
    await service.register('Device');
    expect(service.isUnlocked()).toBe(true);

    service.lock();

    expect(service.isUnlocked()).toBe(false);
  });
});
