import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  accountMigrationStrategies,
  accountSchema,
  appSettingsMigrationStrategies,
  appSettingsSchema,
  categorizationRuleSchema,
  institutionSchema,
  transactionSchema,
} from '../data/schemas';
import { DatabaseService } from '../data/database.service';
import type { Account, CategorizationRule, Transaction } from '../data/models';
import { planIngest } from '../simplefin/simplefin-ingest-plan.util';
import type { SimplefinAccountSet } from '../simplefin/simplefin-protocol';
import { AccountDeletionService } from './account-deletion.service';

function seedAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1',
    institutionId: 'org-1',
    connId: 'CON-1',
    externalAccountId: 'ext-1',
    originalAccountName: 'Checking',
    name: 'Checking',
    type: 'bank',
    currencyCode: 'USD',
    balance: 100,
    balanceDate: '2026-08-01',
    needsReconnect: false,
    syncIssue: null,
    missing: false,
    isManual: false,
    ...overrides,
  };
}

function seedTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    accountId: 'acc-1',
    date: '2026-08-01',
    description: 'Coffee',
    amount: -4.5,
    pending: false,
    categoryId: null,
    excludeFromBudget: false,
    notes: null,
    ...overrides,
  };
}

function seedRule(overrides: Partial<CategorizationRule> = {}): CategorizationRule {
  return {
    id: 'rule-1',
    accountId: 'acc-1',
    normalizedDescription: 'coffee',
    amount: -4.5,
    dayOfMonth: 1,
    categoryId: 'cat-1',
    createdAtUtc: '2026-08-01T00:00:00.000Z',
    updatedAtUtc: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('AccountDeletionService', () => {
  let fakeDb: RxDatabase;
  let service: AccountDeletionService;

  beforeEach(async () => {
    fakeDb = await createRxDatabase({
      name: `account-deletion-test-${Math.random().toString(36).slice(2)}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
    });
    await fakeDb.addCollections({
      accounts: { schema: accountSchema, migrationStrategies: accountMigrationStrategies },
      institutions: { schema: institutionSchema },
      transactions: { schema: transactionSchema },
      categorizationRules: { schema: categorizationRuleSchema },
      appSettings: { schema: appSettingsSchema, migrationStrategies: appSettingsMigrationStrategies },
    });
    await fakeDb['institutions'].insert({ id: 'org-1', name: 'My Bank', url: null });

    TestBed.configureTestingModule({
      providers: [
        AccountDeletionService,
        { provide: DatabaseService, useValue: { getDatabase: () => Promise.resolve(fakeDb) } },
      ],
    });
    service = TestBed.inject(AccountDeletionService);
  });

  afterEach(async () => {
    await fakeDb.remove();
  });

  it('deletes the account, its transactions, and its categorization rules', async () => {
    await fakeDb['accounts'].insert(seedAccount());
    await fakeDb['transactions'].insert(seedTransaction());
    await fakeDb['categorizationRules'].insert(seedRule());

    await service.deleteAccount('acc-1');

    expect(await fakeDb['accounts'].findOne('acc-1').exec()).toBeNull();
    expect(await fakeDb['transactions'].find().exec()).toHaveLength(0);
    expect(await fakeDb['categorizationRules'].find().exec()).toHaveLength(0);
  });

  it('deletes a manual account without adding an ignoredExternalAccounts entry', async () => {
    await fakeDb['accounts'].insert(seedAccount({ connId: 'manual:acc-1', isManual: true }));

    await service.deleteAccount('acc-1');

    const settings = await fakeDb['appSettings'].findOne('settings').exec();
    expect(settings?.ignoredExternalAccounts ?? []).toHaveLength(0);
  });

  it('adds a deleted real account to ignoredExternalAccounts', async () => {
    await fakeDb['accounts'].insert(seedAccount());

    await service.deleteAccount('acc-1');

    const settings = await fakeDb['appSettings'].findOne('settings').exec();
    expect(settings?.ignoredExternalAccounts).toEqual([
      { key: 'CON-1:ext-1', name: 'Checking', institutionName: 'My Bank' },
    ]);
  });

  it('ignores a deleted real account the same way whether or not a sibling account remains on the connection', async () => {
    await fakeDb['accounts'].insert(seedAccount());
    await fakeDb['accounts'].insert(
      seedAccount({ id: 'acc-2', externalAccountId: 'ext-2', name: 'Savings' })
    );

    await service.deleteAccount('acc-1');

    const settings = await fakeDb['appSettings'].findOne('settings').exec();
    expect(settings?.ignoredExternalAccounts).toEqual([
      { key: 'CON-1:ext-1', name: 'Checking', institutionName: 'My Bank' },
    ]);
    expect(await fakeDb['accounts'].findOne('acc-2').exec()).not.toBeNull();
  });

  it('does not double-add an already-ignored key', async () => {
    await fakeDb['accounts'].insert(seedAccount());
    await fakeDb['appSettings'].insert({
      id: 'settings',
      lastSyncDate: null,
      webauthnCredential: null,
      passwordHash: null,
      biometricsEnabled: false,
      ignoredExternalAccounts: [{ key: 'CON-1:ext-1', name: 'Checking', institutionName: 'My Bank' }],
      exportEncryptionDefault: false,
    });

    await service.deleteAccount('acc-1');

    const settings = await fakeDb['appSettings'].findOne('settings').exec();
    expect(settings?.ignoredExternalAccounts).toHaveLength(1);
  });

  it('suppresses rediscovery of the deleted real account on a subsequent sync', async () => {
    await fakeDb['accounts'].insert(seedAccount());

    await service.deleteAccount('acc-1');

    const settings = await fakeDb['appSettings'].findOne('settings').exec();
    const merged: SimplefinAccountSet = {
      errlist: [],
      connections: [{ conn_id: 'CON-1', name: 'Checking', org_id: 'org-1', org_name: 'My Bank', org_url: null }],
      accounts: [
        {
          id: 'ext-1',
          name: 'Checking',
          currency: 'USD',
          balance: '100.00',
          'balance-date': 1786608000,
          conn_id: 'CON-1',
          transactions: [],
        },
      ],
    };

    // No tracked accounts remain (it was deleted) — planIngest would normally treat the
    // still-live SimpleFIN account as newly discovered, which is exactly what
    // ignoredExternalAccounts must prevent.
    const plan = planIngest([], merged, settings?.ignoredExternalAccounts ?? []);

    expect(plan.discovered).toHaveLength(0);
  });

  it('does not error deleting an account with zero transactions or rules', async () => {
    await fakeDb['accounts'].insert(seedAccount());

    await expect(service.deleteAccount('acc-1')).resolves.toBeUndefined();
  });

  it('is a no-op for a nonexistent account id', async () => {
    await expect(service.deleteAccount('does-not-exist')).resolves.toBeUndefined();
  });
});
