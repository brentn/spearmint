import { createRxDatabase, randomToken, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
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

describe('domain schemas', () => {
  let db: RxDatabase;

  beforeEach(async () => {
    db = await createRxDatabase({
      name: `spearmint-test-${randomToken(10)}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
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
  });

  afterEach(async () => {
    await db.remove();
  });

  it('accepts a minimal valid institution', async () => {
    const doc = await db['institutions'].insert({ id: 'inst-1', name: 'Ally Bank', url: null });
    expect(doc.name).toBe('Ally Bank');
  });

  it('accepts a minimal valid account', async () => {
    const doc = await db['accounts'].insert({
      id: 'acc-1',
      institutionId: 'inst-1',
      connId: 'conn-1',
      externalAccountId: 'ext-1',
      originalAccountName: 'Checking',
      name: 'Checking',
      type: 'bank',
      currencyCode: 'USD',
      balance: 100.5,
      balanceDate: '2026-08-01',
      needsReconnect: false,
      syncIssue: null,
      missing: false,
    });
    expect(doc.type).toBe('bank');
  });

  it('rejects an account with an invalid type', async () => {
    await expect(
      db['accounts'].insert({
        id: 'acc-2',
        institutionId: 'inst-1',
        connId: 'conn-1',
        externalAccountId: 'ext-2',
        originalAccountName: 'Checking',
        name: 'Checking',
        type: 'savings' as never,
        currencyCode: 'USD',
        balance: 0,
        balanceDate: '2026-08-01',
        needsReconnect: false,
        syncIssue: null,
        missing: false,
      })
    ).rejects.toThrow();
  });

  it('accepts a category with a third, transfer type', async () => {
    const doc = await db['categories'].insert({
      id: 'cat-1',
      name: 'Credit Card Payment',
      parentCategoryId: null,
      type: 'transfer',
    });
    expect(doc.type).toBe('transfer');
  });

  it('accepts a minimal valid transaction', async () => {
    const doc = await db['transactions'].insert({
      id: 'txn-1',
      accountId: 'acc-1',
      date: '2026-08-01',
      description: 'COFFEE SHOP',
      amount: -4.5,
      pending: false,
      categoryId: null,
      excludeFromBudget: false,
      notes: null,
    });
    expect(doc.description).toBe('COFFEE SHOP');
  });

  it('accepts a minimal valid budget', async () => {
    const doc = await db['budgets'].insert({
      id: 'bud-1',
      categoryId: 'cat-1',
      periodType: 'month',
      period: '2026-08',
      rollOver: true,
      amount: 200,
    });
    expect(doc.rollOver).toBe(true);
  });

  it('accepts a minimal valid categorization rule', async () => {
    const doc = await db['categorizationRules'].insert({
      id: 'rule-1',
      accountId: 'acc-1',
      normalizedDescription: 'coffee shop',
      amount: -4.5,
      dayOfMonth: 1,
      categoryId: 'cat-1',
      createdAtUtc: '2026-08-01T00:00:00.000Z',
      updatedAtUtc: '2026-08-01T00:00:00.000Z',
    });
    expect(doc.categoryId).toBe('cat-1');
  });

  it('stores the app settings singleton with a null webauthn credential by default', async () => {
    const doc = await db['appSettings'].insert({
      id: 'settings',
      lastSyncDate: null,
      webauthnCredential: null,
      ignoredExternalAccounts: [],
      exportEncryptionDefault: false,
    });
    expect(doc.webauthnCredential).toBeNull();
  });

  it('stores a full webauthn credential once registered', async () => {
    const doc = await db['appSettings'].insert({
      id: 'settings',
      lastSyncDate: null,
      webauthnCredential: { id: 'cred-1', publicKey: 'pk-base64', algorithm: 'ES256' },
      ignoredExternalAccounts: [],
      exportEncryptionDefault: false,
    });
    expect(doc.webauthnCredential?.algorithm).toBe('ES256');
  });

  it('accepts a minimal valid simplefin link', async () => {
    const doc = await db['simplefinLinks'].insert({
      id: 'link-1',
      accessUrl: 'https://user:pass@bridge.simplefin.org/simplefin',
      claimedAtUtc: '2026-08-01T00:00:00.000Z',
    });
    expect(doc.accessUrl).toBe('https://user:pass@bridge.simplefin.org/simplefin');
  });
});
