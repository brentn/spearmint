import type {
  Account,
  AppSettings,
  Budget,
  Category,
  CategorizationRule,
  Institution,
  Transaction,
} from '../data/models';
import { currentYearMonth } from '../budgets/period.util';

export function seedInstitution(overrides: Partial<Institution> = {}): Institution {
  return { id: 'org-1', name: 'My Bank', url: null, ...overrides };
}

export function seedAccount(overrides: Partial<Account> = {}): Account {
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

export function seedCategory(overrides: Partial<Category> = {}): Category {
  return { id: 'cat-1', name: 'Groceries', parentCategoryId: null, type: 'expense', ...overrides };
}

export function seedTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    accountId: 'acc-1',
    date: '2026-08-14',
    description: "Trader Joe's",
    amount: -64.2,
    pending: false,
    categoryId: null,
    excludeFromBudget: false,
    notes: null,
    ...overrides,
  };
}

export function seedBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-1',
    categoryId: 'cat-1',
    periodType: 'month',
    period: currentYearMonth(),
    rollOver: false,
    rolloverAmount: 0,
    amount: 500,
    ...overrides,
  };
}

export function seedCategorizationRule(
  overrides: Partial<CategorizationRule> = {},
): CategorizationRule {
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

export function seedAppSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    id: 'settings',
    lastSyncDate: null,
    webauthnCredential: null,
    ignoredExternalAccounts: [],
    exportEncryptionDefault: false,
    passwordHash: null,
    biometricsEnabled: false,
    ...overrides,
  };
}
