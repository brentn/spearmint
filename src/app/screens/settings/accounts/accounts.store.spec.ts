import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountSchema, appSettingsSchema, institutionSchema } from '../../../data/schemas';
import { DatabaseService } from '../../../data/database.service';
import type { Account } from '../../../data/models';
import { SimplefinLinkService } from '../../../simplefin/simplefin-link.service';
import { SimplefinSyncService } from '../../../simplefin/simplefin-sync.service';
import { AccountsStore } from './accounts.store';

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
    ...overrides,
  };
}

describe('AccountsStore', () => {
  let fakeDb: RxDatabase;
  let claim: ReturnType<typeof vi.fn>;
  let syncNow: ReturnType<typeof vi.fn>;
  let addDiscoveredAccount: ReturnType<typeof vi.fn>;
  let ignoreDiscoveredAccount: ReturnType<typeof vi.fn>;
  let unignoreDiscoveredAccount: ReturnType<typeof vi.fn>;
  let store: AccountsStore;

  beforeEach(async () => {
    fakeDb = await createRxDatabase({
      name: `accounts-store-test-${Math.random().toString(36).slice(2)}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
    });
    await fakeDb.addCollections({
      accounts: { schema: accountSchema },
      institutions: { schema: institutionSchema },
      appSettings: { schema: appSettingsSchema },
    });
    await fakeDb['institutions'].insert({ id: 'org-1', name: 'My Bank', url: null });
    await fakeDb['appSettings'].upsert({
      id: 'settings',
      lastSyncDate: null,
      webauthnCredential: null,
      ignoredExternalAccounts: [{ key: 'CON-1:ext-ignored', name: 'Old Savings', institutionName: 'My Bank' }],
      exportEncryptionDefault: false,
    });

    claim = vi.fn().mockResolvedValue(undefined);
    syncNow = vi.fn().mockResolvedValue({ success: true, error: null });
    addDiscoveredAccount = vi.fn().mockResolvedValue(undefined);
    ignoreDiscoveredAccount = vi.fn().mockResolvedValue(undefined);
    unignoreDiscoveredAccount = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        AccountsStore,
        { provide: DatabaseService, useValue: { getDatabase: () => Promise.resolve(fakeDb) } },
        { provide: SimplefinLinkService, useValue: { claim } },
        {
          provide: SimplefinSyncService,
          useValue: {
            syncing: signal(false),
            syncNow,
            addDiscoveredAccount,
            ignoreDiscoveredAccount,
            unignoreDiscoveredAccount,
          },
        },
      ],
    });
    store = TestBed.inject(AccountsStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
  });

  afterEach(async () => {
    await fakeDb.remove();
  });

  it('loads accounts, institutions, and ignored external accounts on construction', () => {
    expect(store.institutions()).toEqual([{ id: 'org-1', name: 'My Bank', url: null }]);
    expect(store.ignoredExternalAccounts()).toEqual([
      { key: 'CON-1:ext-ignored', name: 'Old Savings', institutionName: 'My Bank' },
    ]);
  });

  it('institutionName resolves a known institution and falls back for an unknown one', () => {
    expect(store.institutionName('org-1')).toBe('My Bank');
    expect(store.institutionName('org-missing')).toBe('Unknown institution');
  });

  it('connectBank claims the token, syncs, and refreshes', async () => {
    await fakeDb['accounts'].insert(seedAccount());

    await store.connectBank('some-token');

    expect(claim).toHaveBeenCalledWith('some-token');
    expect(syncNow).toHaveBeenCalled();
    expect(store.accounts()).toHaveLength(1);
    expect(store.connectError()).toBeNull();
  });

  it('surfaces a claim failure without leaving the connecting flag stuck', async () => {
    claim.mockRejectedValue(new Error('bad token'));

    await store.connectBank('bad-token');

    expect(store.connectError()).toBe('bad token');
    expect(store.connecting()).toBe(false);
  });

  it('renameAccount patches the account and refreshes', async () => {
    await fakeDb['accounts'].insert(seedAccount());
    await store.refresh();

    await store.renameAccount('acc-1', 'Everyday Checking');

    expect(store.accounts()[0].name).toBe('Everyday Checking');
  });

  it('setAccountType patches the account type and refreshes', async () => {
    await fakeDb['accounts'].insert(seedAccount());
    await store.refresh();

    await store.setAccountType('acc-1', 'creditCard');

    expect(store.accounts()[0].type).toBe('creditCard');
  });

  it('unignore delegates to the sync service and refreshes', async () => {
    await store.unignore('CON-1:ext-ignored');

    expect(unignoreDiscoveredAccount).toHaveBeenCalledWith('CON-1:ext-ignored');
  });

  it('addDiscovered delegates to the sync service and refreshes', async () => {
    const discovered = {
      connId: 'CON-1',
      externalAccountId: 'ext-new',
      name: 'New Savings',
      orgId: 'org-1',
      orgName: 'My Bank',
      currencyCode: 'USD',
      balance: '10.00',
      balanceDateEpoch: 1786608000,
    };

    await store.addDiscovered(discovered, 'bank');

    expect(addDiscoveredAccount).toHaveBeenCalledWith(discovered, 'bank');
  });

  it('ignoreDiscovered delegates to the sync service and refreshes', async () => {
    const discovered = {
      connId: 'CON-1',
      externalAccountId: 'ext-new',
      name: 'New Savings',
      orgId: 'org-1',
      orgName: 'My Bank',
      currencyCode: 'USD',
      balance: '10.00',
      balanceDateEpoch: 1786608000,
    };

    await store.ignoreDiscovered(discovered);

    expect(ignoreDiscoveredAccount).toHaveBeenCalledWith(discovered);
  });
});
