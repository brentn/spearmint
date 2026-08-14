import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  accountSchema,
  appSettingsMigrationStrategies,
  appSettingsSchema,
  budgetSchema,
  categorizationRuleSchema,
  categorySchema,
  institutionSchema,
  simplefinLinkSchema,
  transactionSchema,
} from './schemas';
import { BackupService } from './backup.service';
import { DatabaseService, type SpearmintCollections, type SpearmintDatabase } from './database.service';
import type { Account, AppSettings, Category } from './models';
import { seedDefaultCategoriesIfEmpty } from '../categories/default-category-seed';

// A hand-rolled fake DatabaseService (real RxDB memory storage underneath, same
// trick as auth.service.spec.ts) rather than routing through the production
// DatabaseService: this service's own import/reset behavior is what's under test
// here, not DatabaseService's storage/migration internals — that's
// database.service.spec.ts's job. The storage is still wrapped with
// wrappedValidateAjvStorage: RxDB's dev-mode plugin is a module-level toggle
// (registered via addRxPlugin), so once any spec file in the same vitest worker
// enables it, every createRxDatabase() call in that worker must use a
// schema-validating storage or fail with RxDB error DVM1 — regardless of which
// file triggered it. It still calls seedDefaultCategoriesIfEmpty on every open,
// same as the real DatabaseService.openDatabase() — that's the one behavior of the
// real class this file's round-trip tests need to reproduce faithfully, since a
// reset-then-reopen mid-import re-triggers it on the now-empty categories collection.
class FakeDatabaseService {
  private db: RxDatabase<SpearmintCollections> | null = null;

  async getDatabase(): Promise<RxDatabase<SpearmintCollections>> {
    if (!this.db) {
      this.db = await this.createDatabase();
    }
    return this.db;
  }

  async resetDatabase(): Promise<void> {
    const db = await this.getDatabase();
    await db.remove();
    this.db = null;
  }

  private async createDatabase(): Promise<RxDatabase<SpearmintCollections>> {
    const db = await createRxDatabase<SpearmintCollections>({
      name: `backup-test-${Math.random().toString(36).slice(2)}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
      multiInstance: false,
    });
    await db.addCollections({
      institutions: { schema: institutionSchema },
      accounts: { schema: accountSchema },
      categories: { schema: categorySchema },
      transactions: { schema: transactionSchema },
      budgets: { schema: budgetSchema },
      categorizationRules: { schema: categorizationRuleSchema },
      appSettings: { schema: appSettingsSchema, migrationStrategies: appSettingsMigrationStrategies },
      simplefinLinks: { schema: simplefinLinkSchema },
    });
    // seedDefaultCategoriesIfEmpty is typed against SpearmintDatabase's Angular
    // reactivity factory param, which this plain test db doesn't provide —
    // same cast default-category-seed.spec.ts already uses for the same reason.
    await seedDefaultCategoriesIfEmpty(db as unknown as SpearmintDatabase);
    return db;
  }
}

// jsdom's Blob isn't recognized by its own Response constructor (reading it back
// via `new Response(blob).text()` yields the literal string "[object Blob]"), so
// tests read the exported blob back the same way the real import screen will —
// via FileReader against an uploaded File — rather than Response/blob.text().
function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

const checking: Account = {
  id: 'acc-1',
  institutionId: 'org-1',
  connId: 'CON-1',
  externalAccountId: 'ext-1',
  originalAccountName: 'Checking',
  name: 'Checking',
  type: 'bank',
  currencyCode: 'USD',
  balance: 123.45,
  balanceDate: '2026-08-01',
  needsReconnect: false,
  syncIssue: null,
  missing: false,
};

const groceries: Category = {
  id: 'cat-1',
  name: 'Groceries',
  parentCategoryId: null,
  type: 'expense',
};

const settingsDoc: AppSettings = {
  id: 'settings',
  lastSyncDate: '2026-08-01',
  webauthnCredential: { id: 'cred-1', publicKey: 'pk', algorithm: 'ES256', transports: ['internal'] },
  ignoredExternalAccounts: [],
  exportEncryptionDefault: false,
};

describe('BackupService', () => {
  let fakeDatabaseService: FakeDatabaseService;

  beforeEach(() => {
    fakeDatabaseService = new FakeDatabaseService();
    TestBed.configureTestingModule({
      providers: [BackupService, { provide: DatabaseService, useValue: fakeDatabaseService }],
    });
  });

  afterEach(async () => {
    const db = await fakeDatabaseService.getDatabase();
    await db.close();
  });

  async function seed(): Promise<void> {
    const db = await fakeDatabaseService.getDatabase();
    await db.accounts.insert(checking);
    await db.categories.insert(groceries);
    await db.appSettings.insert(settingsDoc);
  }

  it('round-trips an unencrypted export through import', async () => {
    await seed();
    const dbBeforeExport = await fakeDatabaseService.getDatabase();
    const categoryCountBeforeExport = await dbBeforeExport.categories.count().exec();
    const service = TestBed.inject(BackupService);

    const blob = await service.exportBackup(false, '');
    const fileText = await readBlobText(blob);
    await service.importBackup(fileText, null);

    const db = await fakeDatabaseService.getDatabase();
    const account = await db.accounts.findOne('acc-1').exec();
    const category = await db.categories.findOne('cat-1').exec();
    const settings = await db.appSettings.findOne('settings').exec();
    expect(account?.toJSON()).toEqual(checking);
    expect(category?.toJSON()).toEqual(groceries);
    expect(settings?.webauthnCredential).toEqual(settingsDoc.webauthnCredential);
    // Reopening after reset re-seeds the default category taxonomy into the
    // now-empty categories collection (DatabaseService's first-run
    // convenience) before the import runs — guards against that reseed
    // leaving extra categories behind alongside the imported ones.
    expect(await db.categories.count().exec()).toBe(categoryCountBeforeExport);
  });

  it('round-trips an encrypted export through import with the correct password', async () => {
    await seed();
    const service = TestBed.inject(BackupService);

    const blob = await service.exportBackup(true, 'correct horse battery');
    const fileText = await readBlobText(blob);
    await service.importBackup(fileText, 'correct horse battery');

    const db = await fakeDatabaseService.getDatabase();
    const account = await db.accounts.findOne('acc-1').exec();
    expect(account?.toJSON()).toEqual(checking);
  });

  it('rejects an encrypted import with the wrong password without touching existing data', async () => {
    await seed();
    const service = TestBed.inject(BackupService);
    const blob = await service.exportBackup(true, 'correct horse battery');
    const fileText = await readBlobText(blob);

    await expect(service.importBackup(fileText, 'wrong password')).rejects.toThrow(
      'Incorrect password, or the backup file is corrupted.'
    );

    const db = await fakeDatabaseService.getDatabase();
    const account = await db.accounts.findOne('acc-1').exec();
    expect(account?.toJSON()).toEqual(checking);
  });

  it('rejects an encrypted import with no password without touching existing data', async () => {
    await seed();
    const service = TestBed.inject(BackupService);
    const blob = await service.exportBackup(true, 'correct horse battery');
    const fileText = await readBlobText(blob);

    await expect(service.importBackup(fileText, null)).rejects.toThrow(
      'This backup is encrypted — enter the password to import it.'
    );

    const db = await fakeDatabaseService.getDatabase();
    const account = await db.accounts.findOne('acc-1').exec();
    expect(account?.toJSON()).toEqual(checking);
  });

  it('rejects a file that is not valid JSON without touching existing data', async () => {
    await seed();
    const service = TestBed.inject(BackupService);

    await expect(service.importBackup('not json at all', null)).rejects.toThrow(
      'That file is not a valid Spearmint backup.'
    );

    const db = await fakeDatabaseService.getDatabase();
    const account = await db.accounts.findOne('acc-1').exec();
    expect(account?.toJSON()).toEqual(checking);
  });

  it('rejects a JSON file that is not a Spearmint backup envelope', async () => {
    await seed();
    const service = TestBed.inject(BackupService);

    await expect(service.importBackup(JSON.stringify({ hello: 'world' }), null)).rejects.toThrow(
      'That file is not a valid Spearmint backup.'
    );
  });

  it('exporting unencrypted remembers exportEncryptionDefault as false', async () => {
    await seed();
    const db = await fakeDatabaseService.getDatabase();
    const settingsBeforeExport = await db.appSettings.findOne('settings').exec();
    await settingsBeforeExport?.incrementalPatch({ exportEncryptionDefault: true });
    const service = TestBed.inject(BackupService);

    await service.exportBackup(false, '');

    const settings = await db.appSettings.findOne('settings').exec();
    expect(settings?.exportEncryptionDefault).toBe(false);
  });

  it('exporting encrypted remembers exportEncryptionDefault as true', async () => {
    await seed();
    const service = TestBed.inject(BackupService);

    await service.exportBackup(true, 'a password');

    const db = await fakeDatabaseService.getDatabase();
    const settings = await db.appSettings.findOne('settings').exec();
    expect(settings?.exportEncryptionDefault).toBe(true);
  });

  it('getExportEncryptionDefault reads the stored default, false when no settings doc exists', async () => {
    const db = await fakeDatabaseService.getDatabase();
    const service = TestBed.inject(BackupService);

    expect(await service.getExportEncryptionDefault()).toBe(false);

    await db.appSettings.insert({ ...settingsDoc, exportEncryptionDefault: true });
    expect(await service.getExportEncryptionDefault()).toBe(true);
  });
});
