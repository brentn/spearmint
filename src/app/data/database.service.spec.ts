import { TestBed } from '@angular/core/testing';
import {
  createRxDatabase,
  getDefaultRevision,
  getDefaultRxDocumentMeta,
  getPrimaryKeyOfInternalDocument,
  removeRxDatabase,
  randomToken,
  INTERNAL_CONTEXT_STORAGE_TOKEN,
  INTERNAL_STORAGE_NAME,
  INTERNAL_STORE_SCHEMA,
  type RxJsonSchema,
  type RxStorage,
} from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { accountSchema } from './schemas';
import { DatabaseService, RX_STORAGE } from './database.service';

// DatabaseService defaults to the real Dexie/IndexedDB driver, which isn't
// available under vitest. Overriding the RX_STORAGE token with RxDB's memory
// storage (rather than vi.mock'ing the dexie module — unreliable here since
// other spec files' static `import DatabaseService` can resolve that module
// before this file's mock registers, under Vitest's shared-worker module
// cache) lets these tests exercise DatabaseService's actual startup/migration
// logic against real RxDB behavior instead of skipping this class entirely.
let currentStorage: RxStorage<unknown, unknown>;

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
    TestBed.configureTestingModule({ providers: [DatabaseService, { provide: RX_STORAGE, useValue: currentStorage }] });
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

  it('silently resets a database left over from an incompatible RxDB major version', async () => {
    // Simulate a database created by an old RxDB major version (e.g. the
    // pre-rebuild Spearmint app, RxDB 15, on the same default dev-server
    // origin) by writing a storage-token doc tagged with that version
    // directly — this is what createRxDatabase() checks to throw DM5.
    const internalStoreInstance = await currentStorage.createStorageInstance({
      databaseInstanceToken: randomToken(10),
      databaseName: 'spearmint',
      collectionName: INTERNAL_STORAGE_NAME,
      schema: INTERNAL_STORE_SCHEMA,
      options: {},
      multiInstance: false,
      devMode: false,
    });
    const key = 'storageToken';
    await internalStoreInstance.bulkWrite(
      [
        {
          document: {
            id: getPrimaryKeyOfInternalDocument(key, INTERNAL_CONTEXT_STORAGE_TOKEN),
            context: INTERNAL_CONTEXT_STORAGE_TOKEN,
            key,
            data: { rxdbVersion: '15.17.0', token: randomToken(10), instanceToken: randomToken(10) },
            _deleted: false,
            _meta: getDefaultRxDocumentMeta(),
            _rev: getDefaultRevision(),
            _attachments: {},
          },
        },
      ],
      'test-setup'
    );
    await internalStoreInstance.close();

    const service = TestBed.inject(DatabaseService);
    const db = await service.getDatabase();
    openDb = db;

    // No error, no hang — just a fresh, usable database.
    expect(Object.keys(db.collections).sort()).toEqual(
      ['accounts', 'appSettings', 'budgets', 'categories', 'categorizationRules', 'institutions', 'simplefinLinks', 'transactions'].sort()
    );
  });
});
