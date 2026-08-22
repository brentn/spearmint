import { addRxPlugin, type MigrationStrategies, type RxJsonSchema } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import type {
  Account,
  AppSettings,
  Budget,
  Category,
  CategorizationRule,
  Institution,
  SimplefinLink,
  Transaction,
} from './models';

// Any collection here can gain a migrationStrategies entry when its schema's
// version bumps (see appSettingsSchema below) — the plugin needs to be active
// everywhere these schemas are used, not just in the production DatabaseService.
addRxPlugin(RxDBMigrationSchemaPlugin);

export const institutionSchema: RxJsonSchema<Institution> = {
  title: 'institution',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    url: { type: ['string', 'null'] },
  },
  required: ['id', 'name'],
};

export const accountSchema: RxJsonSchema<Account> = {
  title: 'account',
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    institutionId: { type: 'string', maxLength: 100 },
    connId: { type: 'string', maxLength: 100 },
    externalAccountId: { type: 'string', maxLength: 100 },
    originalAccountName: { type: 'string' },
    name: { type: 'string' },
    type: { type: 'string', enum: ['bank', 'creditCard'] },
    currencyCode: { type: 'string' },
    balance: { type: 'number', minimum: -1000000000, maximum: 1000000000, multipleOf: 0.01 },
    balanceDate: { type: 'string' },
    needsReconnect: { type: 'boolean' },
    syncIssue: { type: ['string', 'null'] },
    missing: { type: 'boolean' },
    isManual: { type: 'boolean' },
  },
  required: [
    'id',
    'institutionId',
    'connId',
    'externalAccountId',
    'originalAccountName',
    'name',
    'type',
    'currencyCode',
    'balance',
    'balanceDate',
    'needsReconnect',
    'missing',
    'isManual',
  ],
  indexes: ['institutionId', 'connId'],
};

/**
 * v0 -> v1: adds `isManual` (issue #37, Manual Accounts). Every pre-existing account was
 * SimpleFIN-linked, so migrated rows default to `isManual: false` — no existing account
 * silently becomes manual, and the sync loop keeps treating it exactly as before.
 */
export const accountMigrationStrategies: MigrationStrategies = {
  1: (oldDoc: Record<string, unknown>) => ({
    ...oldDoc,
    isManual: false,
  }),
};

export const categorySchema: RxJsonSchema<Category> = {
  title: 'category',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    parentCategoryId: { type: ['string', 'null'] },
    type: { type: 'string', enum: ['expense', 'income', 'transfer'] },
  },
  required: ['id', 'name', 'type'],
};

export const transactionSchema: RxJsonSchema<Transaction> = {
  title: 'transaction',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    accountId: { type: 'string', maxLength: 100 },
    date: { type: 'string', maxLength: 10 },
    description: { type: 'string' },
    amount: { type: 'number', minimum: -1000000000, maximum: 1000000000, multipleOf: 0.01 },
    pending: { type: 'boolean' },
    categoryId: { type: ['string', 'null'] },
    excludeFromBudget: { type: 'boolean' },
    notes: { type: ['string', 'null'] },
  },
  required: ['id', 'accountId', 'date', 'description', 'amount', 'pending', 'excludeFromBudget'],
  indexes: ['accountId', 'date'],
};

export const budgetSchema: RxJsonSchema<Budget> = {
  title: 'budget',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    categoryId: { type: 'string', maxLength: 100 },
    periodType: { type: 'string', enum: ['month', 'year'] },
    period: { type: 'string', maxLength: 7 },
    rollOver: { type: 'boolean' },
    rolloverAmount: { type: 'number', minimum: 0, maximum: 1000000000, multipleOf: 0.01 },
    amount: { type: 'number', minimum: 0, maximum: 1000000000, multipleOf: 0.01 },
  },
  required: ['id', 'categoryId', 'periodType', 'period', 'rollOver', 'amount'],
  indexes: ['categoryId', 'period'],
};

export const categorizationRuleSchema: RxJsonSchema<CategorizationRule> = {
  title: 'categorizationRule',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    accountId: { type: 'string', maxLength: 100 },
    normalizedDescription: { type: 'string' },
    amount: { type: 'number', minimum: -1000000000, maximum: 1000000000, multipleOf: 0.01 },
    dayOfMonth: { type: 'number', minimum: 1, maximum: 31, multipleOf: 1 },
    categoryId: { type: 'string', maxLength: 100 },
    createdAtUtc: { type: 'string' },
    updatedAtUtc: { type: 'string' },
  },
  required: [
    'id',
    'accountId',
    'normalizedDescription',
    'amount',
    'dayOfMonth',
    'categoryId',
    'createdAtUtc',
    'updatedAtUtc',
  ],
  indexes: ['accountId'],
};

export const simplefinLinkSchema: RxJsonSchema<SimplefinLink> = {
  title: 'simplefinLink',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    accessUrl: { type: 'string' },
    claimedAtUtc: { type: 'string' },
  },
  required: ['id', 'accessUrl', 'claimedAtUtc'],
};

export const appSettingsSchema: RxJsonSchema<AppSettings> = {
  title: 'appSettings',
  version: 2,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 20, enum: ['settings'], default: 'settings' },
    lastSyncDate: { type: ['string', 'null'] },
    webauthnCredential: {
      type: ['object', 'null'],
      properties: {
        id: { type: 'string' },
        publicKey: { type: 'string' },
        algorithm: { type: 'string' },
        transports: { type: 'array', items: { type: 'string' } },
      },
    },
    ignoredExternalAccounts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          name: { type: 'string' },
          institutionName: { type: 'string' },
        },
        required: ['key', 'name', 'institutionName'],
      },
    },
    exportEncryptionDefault: { type: 'boolean' },
    passwordHash: {
      type: ['object', 'null'],
      properties: {
        salt: { type: 'string' },
        hash: { type: 'string' },
      },
    },
    biometricsEnabled: { type: 'boolean' },
  },
  required: ['id', 'ignoredExternalAccounts', 'exportEncryptionDefault', 'biometricsEnabled'],
};

/**
 * v0 -> v1: ignoredExternalAccounts widened from raw `connId:externalAccountId`
 * strings to { key, name, institutionName } records (issue #8, ignored-accounts
 * labeling). v0 never captured name/institution, so migrated entries fall back to
 * the key itself as the display name — the account stays correctly ignored
 * (matched by key) even though its label can't be reconstructed retroactively.
 */
export const appSettingsMigrationStrategies: MigrationStrategies = {
  1: (oldDoc: { ignoredExternalAccounts: unknown }) => ({
    ...oldDoc,
    ignoredExternalAccounts: Array.isArray(oldDoc.ignoredExternalAccounts)
      ? oldDoc.ignoredExternalAccounts.map((entry: unknown) =>
          typeof entry === 'string' ? { key: entry, name: entry, institutionName: '' } : entry
        )
      : [],
  }),
  /**
   * v1 -> v2: password-primary login (issue #25). Anyone who already registered a
   * security key gets biometricsEnabled turned on automatically — their existing
   * credential becomes the 2nd-step biometric instead of the sole login method —
   * so the app can prompt them to set a password (a later ticket) without also
   * silently disabling the device they already set up.
   */
  2: (oldDoc: { webauthnCredential: unknown }) => ({
    ...oldDoc,
    passwordHash: null,
    biometricsEnabled: !!oldDoc.webauthnCredential,
  }),
};
