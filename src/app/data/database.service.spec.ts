import { TestBed } from '@angular/core/testing';
import { createRxDatabase, removeRxDatabase, type RxJsonSchema, type RxStorage } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountSchema } from './schemas';
import { DatabaseService } from './database.service';

// DatabaseService is hardcoded to the real Dexie/IndexedDB driver, which isn't
// available under vitest. Swapping it for RxDB's memory storage lets these tests
// exercise DatabaseService's actual startup/migration logic against real RxDB
// behavior (not a hand-rolled mock of it) instead of skipping this class entirely.
let currentStorage: RxStorage<unknown, unknown>;
vi.mock('rxdb/plugins/storage-dexie', () => ({
  getRxStorageDexie: () => currentStorage,
}));

// The pre-#8 shape of the appSettings schema: same title, version 0, but
// ignoredExternalAccounts held raw composite-key strings instead of
// { key, name, institutionName } records.
const staleAppSettingsSchema: RxJsonSchema<{
  id: string;
  lastSyncDate: string | null;
  webauthnCredential: unknown;
  ignoredExternalAccounts: string[];
  exportEncryptionDefault: boolean;
}> = {
  title: 'appSettings',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 20, enum: ['settings'], default: 'settings' },
    lastSyncDate: { type: ['string', 'null'] },
    webauthnCredential: { type: ['object', 'null'] },
    ignoredExternalAccounts: { type: 'array', items: { type: 'string' } },
    exportEncryptionDefault: { type: 'boolean' },
  },
  required: ['id', 'ignoredExternalAccounts', 'exportEncryptionDefault'],
};

describe('DatabaseService', () => {
  // RxDB's "database name already in use" guard (DB8) tracks open instances
  // process-wide by (name, storage.name), independent of which storage object
  // created them, so leaving one open leaks into the next test.
  let openDb: { close(): Promise<unknown> } | undefined;

  beforeEach(() => {
    currentStorage = getRxStorageMemory();
    openDb = undefined;
    TestBed.configureTestingModule({ providers: [DatabaseService] });
  });

  afterEach(async () => {
    await openDb?.close();
    await removeRxDatabase('spearmint', currentStorage).catch(() => {});
  });

  it('opens a fresh database with every collection registered', async () => {
    const service = TestBed.inject(DatabaseService);

    const db = await service.getDatabase();
    openDb = db;

    expect(Object.keys(db.collections).sort()).toEqual(
      ['accounts', 'appSettings', 'budgets', 'categories', 'categorizationRules', 'institutions', 'simplefinLinks', 'transactions'].sort()
    );
  });

  it('migrates a local database from a stale AppSettings schema without losing data', async () => {
    // Simulate a browser that already has local data from before the
    // ignoredExternalAccounts shape change: same collection name, old version.
    const staleDb = await createRxDatabase({
      name: 'spearmint',
      storage: wrappedValidateAjvStorage({ storage: currentStorage }),
    });
    await staleDb.addCollections({
      appSettings: { schema: staleAppSettingsSchema },
      accounts: { schema: accountSchema },
    });
    await staleDb['appSettings'].insert({
      id: 'settings',
      lastSyncDate: '2026-08-01',
      webauthnCredential: null,
      ignoredExternalAccounts: ['CON-1:ext-ignored'],
      exportEncryptionDefault: false,
    });
    await staleDb['accounts'].insert({
      id: 'acc-1',
      institutionId: 'org-1',
      connId: 'CON-1',
      externalAccountId: 'ext-1',
      originalAccountName: 'Checking',
      name: 'Checking',
      type: 'bank',
      currencyCode: 'USD',
      balance: 42,
      balanceDate: '2026-08-01',
      needsReconnect: false,
      syncIssue: null,
      missing: false,
    });
    await staleDb.close();

    const service = TestBed.inject(DatabaseService);
    const db = await service.getDatabase();
    openDb = db;

    // The unrelated, never-versioned account survives untouched.
    const account = await db.accounts.findOne('acc-1').exec();
    expect(account?.name).toBe('Checking');

    // The migrated appSettings doc keeps its other fields and converts the
    // legacy ignore-list entry into the new shape, falling back to the key
    // itself as the display name since v0 never captured a friendlier one.
    const settings = await db.appSettings.findOne('settings').exec();
    expect(settings?.lastSyncDate).toBe('2026-08-01');
    expect(settings?.ignoredExternalAccounts).toEqual([
      { key: 'CON-1:ext-ignored', name: 'CON-1:ext-ignored', institutionName: '' },
    ]);
  });
});
