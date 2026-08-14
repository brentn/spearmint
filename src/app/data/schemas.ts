import type { RxJsonSchema } from 'rxdb';
import type {
  Account,
  AppSettings,
  Budget,
  Category,
  CategorizationRule,
  Institution,
  Transaction,
} from './models';

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
  version: 0,
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
  ],
  indexes: ['institutionId', 'connId'],
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

export const appSettingsSchema: RxJsonSchema<AppSettings> = {
  title: 'appSettings',
  version: 0,
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
    ignoredExternalAccounts: { type: 'array', items: { type: 'string' } },
    exportEncryptionDefault: { type: 'boolean' },
  },
  required: ['id', 'ignoredExternalAccounts', 'exportEncryptionDefault'],
};
