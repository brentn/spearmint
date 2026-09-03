import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { accountMigrationStrategies, accountSchema, institutionSchema } from '../data/schemas';
import { DatabaseService } from '../data/database.service';
import type { Account } from '../data/models';
import type { AccountSyncOutcome, DiscoveredSimplefinAccount } from '../simplefin/simplefin-ingest-plan.util';
import { AccountsService } from './accounts.service';

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

describe('AccountsService', () => {
  let fakeDb: RxDatabase;
  let service: AccountsService;

  beforeEach(async () => {
    fakeDb = await createRxDatabase({
      name: `accounts-service-test-${Math.random().toString(36).slice(2)}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
    });
    await fakeDb.addCollections({
      accounts: { schema: accountSchema, migrationStrategies: accountMigrationStrategies },
      institutions: { schema: institutionSchema },
    });
    await fakeDb['institutions'].insert({ id: 'org-1', name: 'My Bank', url: null });

    TestBed.configureTestingModule({
      providers: [
        AccountsService,
        { provide: DatabaseService, useValue: { getDatabase: () => Promise.resolve(fakeDb) } },
      ],
    });
    service = TestBed.inject(AccountsService);
  });

  afterEach(async () => {
    await fakeDb.remove();
  });

  describe('findById', () => {
    it('returns the account when it exists', async () => {
      await fakeDb['accounts'].insert(seedAccount());

      expect(await service.findById('acc-1')).toMatchObject({ id: 'acc-1', name: 'Checking' });
    });

    it('returns undefined for a nonexistent id', async () => {
      expect(await service.findById('does-not-exist')).toBeUndefined();
    });
  });

  describe('findInstitutionById', () => {
    it('returns the institution when it exists', async () => {
      expect(await service.findInstitutionById('org-1')).toEqual({ id: 'org-1', name: 'My Bank', url: null });
    });

    it('returns undefined for a nonexistent id', async () => {
      expect(await service.findInstitutionById('does-not-exist')).toBeUndefined();
    });
  });

  describe('upsertInstitution', () => {
    it('inserts a new institution', async () => {
      await service.upsertInstitution({ id: 'org-2', name: 'Other Bank', url: null });

      expect(await service.findInstitutionById('org-2')).toEqual({ id: 'org-2', name: 'Other Bank', url: null });
    });

    it('updates an existing institution', async () => {
      await service.upsertInstitution({ id: 'org-1', name: 'Renamed Bank', url: null });

      expect(await service.findInstitutionById('org-1')).toEqual({ id: 'org-1', name: 'Renamed Bank', url: null });
    });
  });

  describe('createManualAccount', () => {
    it('creates a synthetic institution and a zero-balance manual account', async () => {
      const account = await service.createManualAccount('Local Credit Union', 'Stopgap Checking', 'bank');

      expect(account.name).toBe('Stopgap Checking');
      expect(account.type).toBe('bank');
      expect(account.isManual).toBe(true);
      expect(account.balance).toBe(0);
      expect(account.needsReconnect).toBe(false);
      expect(account.syncIssue).toBeNull();
      expect(account.missing).toBe(false);
      // Synthetic, unique to this account — never a real SimpleFIN identity.
      expect(account.connId).toContain(account.id);
      expect(account.externalAccountId).toBe(account.id);

      expect(await service.findInstitutionById(account.institutionId)).toEqual({
        id: account.institutionId,
        name: 'Local Credit Union',
        url: null,
      });
      expect(await service.findById(account.id)).toEqual(account);
    });
  });

  describe('createFromDiscovery', () => {
    const discovered: DiscoveredSimplefinAccount = {
      connId: 'CON-2',
      externalAccountId: 'ext-new',
      name: 'New Savings',
      orgId: 'org-2',
      orgName: 'New Bank',
      currencyCode: 'USD',
      balance: '500.00',
      balanceDateEpoch: 1786608000,
    };

    it('upserts the institution and creates a tracked account from the discovery', async () => {
      const account = await service.createFromDiscovery(discovered, 'bank');

      expect(account.institutionId).toBe('org-2');
      expect(account.connId).toBe('CON-2');
      expect(account.externalAccountId).toBe('ext-new');
      expect(account.balance).toBe(500);
      expect(account.isManual).toBe(false);
      expect(account.needsReconnect).toBe(false);
      expect(account.missing).toBe(false);
      expect(await service.findInstitutionById('org-2')).toEqual({ id: 'org-2', name: 'New Bank', url: null });
    });

    it('does not duplicate an institution already known under the discovered orgId', async () => {
      await service.upsertInstitution({ id: 'org-2', name: 'Stale Name', url: null });

      await service.createFromDiscovery(discovered, 'bank');

      expect(await service.findInstitutionById('org-2')).toEqual({ id: 'org-2', name: 'New Bank', url: null });
    });
  });

  describe('rename', () => {
    it('patches only the name', async () => {
      await fakeDb['accounts'].insert(seedAccount());

      await service.rename('acc-1', 'Everyday Checking');

      const account = await service.findById('acc-1');
      expect(account?.name).toBe('Everyday Checking');
      expect(account?.type).toBe('bank');
    });

    it('is a no-op for a nonexistent account id', async () => {
      await expect(service.rename('does-not-exist', 'x')).resolves.toBeUndefined();
    });
  });

  describe('setType', () => {
    it('patches only the type', async () => {
      await fakeDb['accounts'].insert(seedAccount());

      await service.setType('acc-1', 'creditCard');

      const account = await service.findById('acc-1');
      expect(account?.type).toBe('creditCard');
      expect(account?.name).toBe('Checking');
    });

    it('is a no-op for a nonexistent account id', async () => {
      await expect(service.setType('does-not-exist', 'creditCard')).resolves.toBeUndefined();
    });
  });

  describe('applySyncOutcome', () => {
    it('always patches the reconnect/issue/missing flags', async () => {
      await fakeDb['accounts'].insert(seedAccount({ balance: 42 }));
      const outcome: AccountSyncOutcome = {
        accountId: 'acc-1',
        needsReconnect: true,
        syncIssue: 'quota exceeded',
        missing: false,
        remappedExternalAccountId: null,
        data: null,
      };

      const applied = await service.applySyncOutcome(outcome);

      expect(applied).toBe(true);
      const account = await service.findById('acc-1');
      expect(account?.needsReconnect).toBe(true);
      expect(account?.syncIssue).toBe('quota exceeded');
      // No `data` on the outcome — balance/currency/date are left untouched.
      expect(account?.balance).toBe(42);
    });

    it('patches externalAccountId when the outcome carries a remap', async () => {
      await fakeDb['accounts'].insert(seedAccount());
      const outcome: AccountSyncOutcome = {
        accountId: 'acc-1',
        needsReconnect: false,
        syncIssue: null,
        missing: false,
        remappedExternalAccountId: 'ext-remapped',
        data: null,
      };

      await service.applySyncOutcome(outcome);

      expect((await service.findById('acc-1'))?.externalAccountId).toBe('ext-remapped');
    });

    it('patches currency/balance/balanceDate when the outcome carries matched data', async () => {
      await fakeDb['accounts'].insert(seedAccount());
      const outcome: AccountSyncOutcome = {
        accountId: 'acc-1',
        needsReconnect: false,
        syncIssue: null,
        missing: false,
        remappedExternalAccountId: null,
        data: {
          currencyCode: 'EUR',
          balance: 250.75,
          balanceDate: '2026-08-13',
          postedTransactions: [],
          pendingTransactions: [],
        },
      };

      await service.applySyncOutcome(outcome);

      const account = await service.findById('acc-1');
      expect(account?.currencyCode).toBe('EUR');
      expect(account?.balance).toBe(250.75);
      expect(account?.balanceDate).toBe('2026-08-13');
    });

    it('returns false and does not throw for a nonexistent account id', async () => {
      const outcome: AccountSyncOutcome = {
        accountId: 'does-not-exist',
        needsReconnect: false,
        syncIssue: null,
        missing: true,
        remappedExternalAccountId: null,
        data: null,
      };

      await expect(service.applySyncOutcome(outcome)).resolves.toBe(false);
    });
  });

  describe('remove', () => {
    it('removes the account', async () => {
      await fakeDb['accounts'].insert(seedAccount());

      await service.remove('acc-1');

      expect(await service.findById('acc-1')).toBeUndefined();
    });

    it('is a no-op for a nonexistent account id', async () => {
      await expect(service.remove('does-not-exist')).resolves.toBeUndefined();
    });
  });
});
