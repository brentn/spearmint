import { TestBed } from '@angular/core/testing';
import type { RxDatabase } from 'rxdb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseService } from '../data/database.service';
import { planIngest } from '../simplefin/simplefin-ingest-plan.util';
import type { SimplefinAccountSet } from '../simplefin/simplefin-protocol';
import { seedAccount, seedAppSettings, seedCategorizationRule, seedInstitution, seedTransaction } from '../testing/fixtures';
import { createTestDatabase } from '../testing/test-database';
import { AccountDeletionService } from './account-deletion.service';

describe('AccountDeletionService', () => {
  let fakeDb: RxDatabase;
  let service: AccountDeletionService;

  beforeEach(async () => {
    fakeDb = await createTestDatabase('accounts', 'institutions', 'transactions', 'categorizationRules', 'appSettings');
    await fakeDb['institutions'].insert(seedInstitution());

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
    await fakeDb['categorizationRules'].insert(seedCategorizationRule());

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
    await fakeDb['appSettings'].insert(
      seedAppSettings({
        ignoredExternalAccounts: [{ key: 'CON-1:ext-1', name: 'Checking', institutionName: 'My Bank' }],
      })
    );

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
