import { TestBed } from '@angular/core/testing';
import { createRxDatabase, removeRxDatabase, type RxJsonSchema, type RxStorage } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from './database.service';

// DatabaseService is hardcoded to the real Dexie/IndexedDB driver, which isn't
// available under vitest. Swapping it for RxDB's memory storage lets these tests
// exercise DatabaseService's actual startup/recovery logic against real RxDB
// behavior (not a hand-rolled mock of it) instead of skipping this class entirely.
let currentStorage: RxStorage<unknown, unknown>;
vi.mock('rxdb/plugins/storage-dexie', () => ({
  getRxStorageDexie: () => currentStorage,
}));

// The pre-#8 shape of the appSettings schema: same title/version as the current
// one, but ignoredExternalAccounts held raw composite-key strings instead of
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

  it('drops and recreates a local database left over from a stale schema, instead of hanging', async () => {
    // Simulate a browser that already has local data from before an AppSettings
    // schema change: same collection name, same version, incompatible shape.
    const staleDb = await createRxDatabase({
      name: 'spearmint',
      storage: wrappedValidateAjvStorage({ storage: currentStorage }),
    });
    await staleDb.addCollections({ appSettings: { schema: staleAppSettingsSchema } });
    await staleDb['appSettings'].insert({
      id: 'settings',
      lastSyncDate: null,
      webauthnCredential: null,
      ignoredExternalAccounts: ['CON-1:ext-ignored'],
      exportEncryptionDefault: false,
    });
    await staleDb.close();

    const service = TestBed.inject(DatabaseService);
    const db = await service.getDatabase();
    openDb = db;

    const settings = await db.appSettings.findOne('settings').exec();
    expect(settings).toBeNull();
  });
});
