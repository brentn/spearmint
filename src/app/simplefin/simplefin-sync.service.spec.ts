import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  accountSchema,
  appSettingsMigrationStrategies,
  appSettingsSchema,
  categorizationRuleSchema,
  institutionSchema,
  transactionSchema,
} from '../data/schemas';
import { DatabaseService } from '../data/database.service';
import type { Account, CategorizationRule, IgnoredExternalAccount, Transaction } from '../data/models';
import { CategorizationSuggestionsService } from '../categorization/categorization-suggestions.service';
import { SimplefinApiService } from './simplefin-api.service';
import { SimplefinLinkService } from './simplefin-link.service';
import { SimplefinSyncService } from './simplefin-sync.service';
import type { SimplefinAccountSet } from './simplefin-protocol';
import { addDaysUtc, todayDateOnlyUtc } from './date-only.util';

const TODAY = todayDateOnlyUtc();
const RECENT_PAST = addDaysUtc(TODAY, -3);
const YESTERDAY = addDaysUtc(TODAY, -1);

const connection = {
  conn_id: 'CON-1',
  name: 'Link',
  org_id: 'org-1',
  org_name: 'My Bank',
  org_url: 'https://mybank.example',
};

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
    balance: 0,
    balanceDate: '2026-08-01',
    needsReconnect: false,
    syncIssue: null,
    missing: false,
    ...overrides,
  };
}

describe('SimplefinSyncService', () => {
  let fakeDb: RxDatabase;
  let fetchAccounts: ReturnType<typeof vi.fn>;
  let getAllAccessUrls: ReturnType<typeof vi.fn>;
  let service: SimplefinSyncService;

  beforeEach(async () => {
    fakeDb = await createRxDatabase({
      name: `simplefin-sync-test-${Math.random().toString(36).slice(2)}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
    });
    await fakeDb.addCollections({
      accounts: { schema: accountSchema },
      institutions: { schema: institutionSchema },
      transactions: { schema: transactionSchema },
      categorizationRules: { schema: categorizationRuleSchema },
      appSettings: { schema: appSettingsSchema, migrationStrategies: appSettingsMigrationStrategies },
    });

    fetchAccounts = vi.fn();
    getAllAccessUrls = vi.fn().mockResolvedValue(['https://demo:pass@bridge.simplefin.org/simplefin']);

    TestBed.configureTestingModule({
      providers: [
        SimplefinSyncService,
        { provide: DatabaseService, useValue: { getDatabase: () => Promise.resolve(fakeDb) } },
        { provide: SimplefinApiService, useValue: { fetchAccounts } },
        { provide: SimplefinLinkService, useValue: { getAllAccessUrls } },
      ],
    });
    service = TestBed.inject(SimplefinSyncService);
  });

  afterEach(async () => {
    await fakeDb.remove();
  });

  async function seedSettings(
    overrides: Partial<{ lastSyncDate: string | null; ignoredExternalAccounts: IgnoredExternalAccount[] }> = {}
  ) {
    await fakeDb['appSettings'].upsert({
      id: 'settings',
      lastSyncDate: null,
      webauthnCredential: null,
      ignoredExternalAccounts: [],
      exportEncryptionDefault: false,
      ...overrides,
    });
  }

  it('does nothing and reports success when no access URLs are stored', async () => {
    getAllAccessUrls.mockResolvedValue([]);

    const result = await service.syncNow();

    expect(result).toEqual({ success: true, error: null });
    expect(fetchAccounts).not.toHaveBeenCalled();
  });

  it('syncs a tracked account: balance, posted transactions, and advances lastSyncDate', async () => {
    await seedSettings({ lastSyncDate: RECENT_PAST });
    await fakeDb['accounts'].insert(seedAccount());
    const response: SimplefinAccountSet = {
      errlist: [],
      connections: [connection],
      accounts: [
        {
          id: 'ext-1',
          name: 'Checking',
          currency: 'USD',
          balance: '250.75',
          'balance-date': 1786608000,
          conn_id: 'CON-1',
          transactions: [
            { id: 'txn-1', posted: 1786521600, amount: '-10.00', description: 'Coffee', pending: false },
          ],
        },
      ],
    };
    fetchAccounts.mockResolvedValue(response);

    const result = await service.syncNow();

    expect(result.success).toBe(true);
    const account = await fakeDb['accounts'].findOne('acc-1').exec();
    expect(account.balance).toBe(250.75);
    expect(account.balanceDate).toBe('2026-08-13');
    const txn = await fakeDb['transactions'].findOne('txn-1').exec();
    expect(txn.amount).toBe(-10);
    expect(txn.categoryId).toBeNull();
    const institution = await fakeDb['institutions'].findOne('org-1').exec();
    expect(institution.name).toBe('My Bank');
    const settings = await fakeDb['appSettings'].findOne('settings').exec();
    expect(settings.lastSyncDate).toBe(TODAY);
  });

  it('never re-categorizes an already-known posted transaction', async () => {
    await seedSettings({ lastSyncDate: RECENT_PAST });
    await fakeDb['accounts'].insert(seedAccount());
    await fakeDb['transactions'].insert({
      id: 'txn-1',
      accountId: 'acc-1',
      date: '2026-08-01',
      description: 'Coffee',
      amount: -10,
      pending: false,
      categoryId: 'cat-coffee',
      excludeFromBudget: false,
      notes: null,
    } satisfies Transaction);
    fetchAccounts.mockResolvedValue({
      errlist: [],
      connections: [connection],
      accounts: [
        {
          id: 'ext-1',
          name: 'Checking',
          currency: 'USD',
          balance: '100',
          'balance-date': 1786608000,
          conn_id: 'CON-1',
          transactions: [
            { id: 'txn-1', posted: 1786521600, amount: '-10.50', description: 'Coffee settled', pending: false },
          ],
        },
      ],
    } satisfies SimplefinAccountSet);

    await service.syncNow();

    const txn = await fakeDb['transactions'].findOne('txn-1').exec();
    expect(txn.categoryId).toBe('cat-coffee');
    expect(txn.amount).toBe(-10.5);
    expect(txn.description).toBe('Coffee settled');
  });

  it('auto-applies a category to a new posted transaction that confidently matches a stored rule', async () => {
    await seedSettings({ lastSyncDate: RECENT_PAST });
    await fakeDb['accounts'].insert(seedAccount());
    await fakeDb['categorizationRules'].insert({
      id: 'rule-1',
      accountId: 'acc-1',
      normalizedDescription: 'STARBUCKS',
      amount: -5,
      dayOfMonth: 12,
      categoryId: 'cat-coffee',
      createdAtUtc: '2026-01-01T00:00:00.000Z',
      updatedAtUtc: '2026-01-01T00:00:00.000Z',
    } satisfies CategorizationRule);
    fetchAccounts.mockResolvedValue({
      errlist: [],
      connections: [connection],
      accounts: [
        {
          id: 'ext-1',
          name: 'Checking',
          currency: 'USD',
          balance: '100',
          'balance-date': 1786608000,
          conn_id: 'CON-1',
          transactions: [
            { id: 'txn-new', posted: 1786521600, amount: '-5.00', description: 'Starbucks', pending: false },
          ],
        },
      ],
    } satisfies SimplefinAccountSet);

    await service.syncNow();

    const txn = await fakeDb['transactions'].findOne('txn-new').exec();
    expect(txn.categoryId).toBe('cat-coffee');
  });

  it('records a dismissible suggestion instead of auto-applying a mid-confidence match', async () => {
    await seedSettings({ lastSyncDate: RECENT_PAST });
    await fakeDb['accounts'].insert(seedAccount());
    await fakeDb['categorizationRules'].insert({
      id: 'rule-1',
      accountId: 'acc-1',
      normalizedDescription: 'TARGET STORE DOWNTOWN',
      amount: -40,
      dayOfMonth: 12,
      categoryId: 'cat-shopping',
      createdAtUtc: '2026-01-01T00:00:00.000Z',
      updatedAtUtc: '2026-01-01T00:00:00.000Z',
    } satisfies CategorizationRule);
    fetchAccounts.mockResolvedValue({
      errlist: [],
      connections: [connection],
      accounts: [
        {
          id: 'ext-1',
          name: 'Checking',
          currency: 'USD',
          balance: '100',
          'balance-date': 1786608000,
          conn_id: 'CON-1',
          transactions: [
            {
              id: 'txn-new',
              posted: 1786521600,
              amount: '-40.00',
              description: 'Target Store Uptown Extra',
              pending: false,
            },
          ],
        },
      ],
    } satisfies SimplefinAccountSet);

    await service.syncNow();

    const txn = await fakeDb['transactions'].findOne('txn-new').exec();
    expect(txn.categoryId).toBeNull();
    const suggestions = TestBed.inject(CategorizationSuggestionsService);
    expect(suggestions.get('txn-new')).toBe('cat-shopping');
  });

  it('re-categorizes pending transactions fresh every sync since they are always wiped and reinserted', async () => {
    await seedSettings({ lastSyncDate: RECENT_PAST });
    await fakeDb['accounts'].insert(seedAccount());
    await fakeDb['categorizationRules'].insert({
      id: 'rule-1',
      accountId: 'acc-1',
      normalizedDescription: 'STARBUCKS',
      amount: -5,
      dayOfMonth: 12,
      categoryId: 'cat-coffee',
      createdAtUtc: '2026-01-01T00:00:00.000Z',
      updatedAtUtc: '2026-01-01T00:00:00.000Z',
    } satisfies CategorizationRule);
    fetchAccounts.mockResolvedValue({
      errlist: [],
      connections: [connection],
      accounts: [
        {
          id: 'ext-1',
          name: 'Checking',
          currency: 'USD',
          balance: '100',
          'balance-date': 1786608000,
          conn_id: 'CON-1',
          transactions: [
            { id: 'txn-pending', posted: 1786608000, amount: '-5.00', description: 'Starbucks', pending: true },
          ],
        },
      ],
    } satisfies SimplefinAccountSet);

    await service.syncNow();

    const txn = await fakeDb['transactions'].findOne('txn-pending').exec();
    expect(txn.categoryId).toBe('cat-coffee');
  });

  it('wipes and replaces pending transactions every sync', async () => {
    await seedSettings({ lastSyncDate: RECENT_PAST });
    await fakeDb['accounts'].insert(seedAccount());
    await fakeDb['transactions'].insert({
      id: 'old-pending',
      accountId: 'acc-1',
      date: '2026-08-01',
      description: 'Stale pending',
      amount: -1,
      pending: true,
      categoryId: null,
      excludeFromBudget: false,
      notes: null,
    } satisfies Transaction);
    fetchAccounts.mockResolvedValue({
      errlist: [],
      connections: [connection],
      accounts: [
        {
          id: 'ext-1',
          name: 'Checking',
          currency: 'USD',
          balance: '100',
          'balance-date': 1786608000,
          conn_id: 'CON-1',
          transactions: [
            { id: 'new-pending', posted: 1786608000, amount: '-2.00', description: 'Fresh pending', pending: true },
          ],
        },
      ],
    } satisfies SimplefinAccountSet);

    await service.syncNow();

    expect(await fakeDb['transactions'].findOne('old-pending').exec()).toBeNull();
    const fresh = await fakeDb['transactions'].findOne('new-pending').exec();
    expect(fresh.pending).toBe(true);
    expect(fresh.description).toBe('Fresh pending');
  });

  it('flags needsReconnect from a con.auth error without touching balance', async () => {
    await seedSettings({ lastSyncDate: RECENT_PAST });
    await fakeDb['accounts'].insert(seedAccount({ balance: 42 }));
    fetchAccounts.mockResolvedValue({
      errlist: [{ code: 'con.auth', msg: 'Reauth needed', conn_id: 'CON-1', account_id: 'ext-1' }],
      connections: [connection],
      accounts: [],
    } satisfies SimplefinAccountSet);

    await service.syncNow();

    const account = await fakeDb['accounts'].findOne('acc-1').exec();
    expect(account.needsReconnect).toBe(true);
    expect(account.balance).toBe(42);
    // Per-account errors are not a whole-run failure — lastSyncDate still advances.
    const settings = await fakeDb['appSettings'].findOne('settings').exec();
    expect(settings.lastSyncDate).toBe(TODAY);
  });

  it('leaves lastSyncDate untouched when a request fails outright (rate-limited/unreachable)', async () => {
    await seedSettings({ lastSyncDate: RECENT_PAST });
    await fakeDb['accounts'].insert(seedAccount());
    fetchAccounts.mockRejectedValue(new Error('SimpleFIN sync request failed (HTTP 429).'));

    const result = await service.syncNow();

    expect(result.success).toBe(false);
    expect(result.error).toContain('429');
    expect(service.lastSyncError()).toContain('429');
    const settings = await fakeDb['appSettings'].findOne('settings').exec();
    expect(settings.lastSyncDate).toBe(RECENT_PAST);
  });

  it('surfaces an unclaimed response account via the discoveredAccounts signal', async () => {
    await seedSettings({ lastSyncDate: RECENT_PAST });
    fetchAccounts.mockResolvedValue({
      errlist: [],
      connections: [connection],
      accounts: [
        {
          id: 'ext-new',
          name: 'New Savings',
          currency: 'USD',
          balance: '500',
          'balance-date': 1786608000,
          conn_id: 'CON-1',
          transactions: [],
        },
      ],
    } satisfies SimplefinAccountSet);

    await service.syncNow();

    expect(service.discoveredAccounts()).toHaveLength(1);
    expect(service.discoveredAccounts()[0].name).toBe('New Savings');
  });

  it('addDiscoveredAccount creates the account and its transactions, then clears the discovery', async () => {
    await seedSettings({ lastSyncDate: RECENT_PAST });
    fetchAccounts.mockResolvedValue({
      errlist: [],
      connections: [connection],
      accounts: [
        {
          id: 'ext-new',
          name: 'New Savings',
          currency: 'USD',
          balance: '500.00',
          'balance-date': 1786608000,
          conn_id: 'CON-1',
          transactions: [{ id: 'txn-new', posted: 1786521600, amount: '500.00', description: 'Opening', pending: false }],
        },
      ],
    } satisfies SimplefinAccountSet);
    await service.syncNow();
    const discovered = service.discoveredAccounts()[0];

    await service.addDiscoveredAccount(discovered, 'bank');

    expect(service.discoveredAccounts()).toHaveLength(0);
    const accounts = await fakeDb['accounts'].find().exec();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].externalAccountId).toBe('ext-new');
    expect(accounts[0].balance).toBe(500);
    const txn = await fakeDb['transactions'].findOne('txn-new').exec();
    expect(txn).not.toBeNull();
  });

  it('addDiscoveredAccount is idempotent: calling it twice for the same discovery does not create a duplicate account', async () => {
    await seedSettings({ lastSyncDate: RECENT_PAST });
    fetchAccounts.mockResolvedValue({
      errlist: [],
      connections: [connection],
      accounts: [
        {
          id: 'ext-new',
          name: 'New Savings',
          currency: 'USD',
          balance: '500.00',
          'balance-date': 1786608000,
          conn_id: 'CON-1',
          transactions: [],
        },
      ],
    } satisfies SimplefinAccountSet);
    await service.syncNow();
    const discovered = service.discoveredAccounts()[0];

    await Promise.all([
      service.addDiscoveredAccount(discovered, 'bank'),
      service.addDiscoveredAccount(discovered, 'bank'),
    ]);

    const accounts = await fakeDb['accounts'].find().exec();
    expect(accounts).toHaveLength(1);
  });

  it('ignoreDiscoveredAccount permanently records the connId:externalId key and clears the discovery', async () => {
    await seedSettings({ lastSyncDate: RECENT_PAST });
    fetchAccounts.mockResolvedValue({
      errlist: [],
      connections: [connection],
      accounts: [
        {
          id: 'ext-new',
          name: 'New Savings',
          currency: 'USD',
          balance: '500',
          'balance-date': 1786608000,
          conn_id: 'CON-1',
          transactions: [],
        },
      ],
    } satisfies SimplefinAccountSet);
    await service.syncNow();
    const discovered = service.discoveredAccounts()[0];

    await service.ignoreDiscoveredAccount(discovered);

    expect(service.discoveredAccounts()).toHaveLength(0);
    const settings = await fakeDb['appSettings'].findOne('settings').exec();
    expect(settings.ignoredExternalAccounts).toEqual([
      { key: 'CON-1:ext-new', name: 'New Savings', institutionName: 'My Bank' },
    ]);
  });

  it('unignoreDiscoveredAccount removes the permanent-ignore entry and restores the discovery', async () => {
    await seedSettings({ lastSyncDate: RECENT_PAST });
    fetchAccounts.mockResolvedValue({
      errlist: [],
      connections: [connection],
      accounts: [
        {
          id: 'ext-new',
          name: 'New Savings',
          currency: 'USD',
          balance: '500',
          'balance-date': 1786608000,
          conn_id: 'CON-1',
          transactions: [],
        },
      ],
    } satisfies SimplefinAccountSet);
    await service.syncNow();
    const discovered = service.discoveredAccounts()[0];
    await service.ignoreDiscoveredAccount(discovered);
    expect(service.discoveredAccounts()).toHaveLength(0);

    await service.unignoreDiscoveredAccount('CON-1:ext-new');

    const settings = await fakeDb['appSettings'].findOne('settings').exec();
    expect(settings.ignoredExternalAccounts).toEqual([]);
    expect(service.discoveredAccounts()).toEqual([
      {
        connId: 'CON-1',
        externalAccountId: 'ext-new',
        name: 'New Savings',
        orgId: 'org-1',
        orgName: 'My Bank',
        currencyCode: 'USD',
        balance: '500',
        balanceDateEpoch: 1786608000,
      },
    ]);
  });

  it('unignoreDiscoveredAccount falls back to a full resync when nothing has synced this session', async () => {
    await seedSettings({
      lastSyncDate: RECENT_PAST,
      ignoredExternalAccounts: [{ key: 'CON-1:ext-new', name: 'New Savings', institutionName: 'My Bank' }],
    });
    fetchAccounts.mockResolvedValue({
      errlist: [],
      connections: [connection],
      accounts: [
        {
          id: 'ext-new',
          name: 'New Savings',
          currency: 'USD',
          balance: '500',
          'balance-date': 1786608000,
          conn_id: 'CON-1',
          transactions: [],
        },
      ],
    } satisfies SimplefinAccountSet);

    await service.unignoreDiscoveredAccount('CON-1:ext-new');

    expect(fetchAccounts).toHaveBeenCalled();
    const settings = await fakeDb['appSettings'].findOne('settings').exec();
    expect(settings.ignoredExternalAccounts).toEqual([]);
    expect(service.discoveredAccounts()).toHaveLength(1);
    expect(service.discoveredAccounts()[0].externalAccountId).toBe('ext-new');
  });

  describe('runAutoSyncIfDue', () => {
    it('syncs when lastSyncDate is not today', async () => {
      await seedSettings({ lastSyncDate: YESTERDAY });
      await fakeDb['accounts'].insert(seedAccount());
      fetchAccounts.mockResolvedValue({ errlist: [], connections: [], accounts: [] });

      await service.runAutoSyncIfDue();

      expect(fetchAccounts).toHaveBeenCalled();
    });

    it('skips syncing when lastSyncDate is already today', async () => {
      await seedSettings({ lastSyncDate: TODAY });

      await service.runAutoSyncIfDue();

      expect(fetchAccounts).not.toHaveBeenCalled();
    });
  });
});
