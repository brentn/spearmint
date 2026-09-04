import { describe, expect, it } from 'vitest';
import { currentYearMonth } from '../budgets/period.util';
import {
  seedAccount,
  seedAppSettings,
  seedBudget,
  seedCategorizationRule,
  seedCategory,
  seedInstitution,
  seedTransaction,
} from './fixtures';

describe('fixture builders', () => {
  it('seedInstitution defaults to a single stable institution', () => {
    expect(seedInstitution()).toEqual({ id: 'org-1', name: 'My Bank', url: null });
  });

  it('seedAccount defaults to a valid, non-manual bank account', () => {
    const account = seedAccount();
    expect(account.id).toBe('acc-1');
    expect(account.institutionId).toBe('org-1');
    expect(account.isManual).toBe(false);
  });

  it('seedAccount overrides merge onto the defaults rather than replacing them', () => {
    const account = seedAccount({ balance: 42 });
    expect(account.balance).toBe(42);
    expect(account.name).toBe('Checking');
  });

  it('seedCategory defaults to a top-level expense category', () => {
    expect(seedCategory()).toEqual({ id: 'cat-1', name: 'Groceries', parentCategoryId: null, type: 'expense' });
  });

  it('seedTransaction defaults to an uncategorized, posted transaction', () => {
    const transaction = seedTransaction();
    expect(transaction.categoryId).toBeNull();
    expect(transaction.pending).toBe(false);
    expect(transaction.accountId).toBe('acc-1');
  });

  it('seedBudget defaults to the current month', () => {
    expect(seedBudget().period).toBe(currentYearMonth());
  });

  it('seedCategorizationRule defaults to a rule tied to the default account and category', () => {
    const rule = seedCategorizationRule();
    expect(rule.accountId).toBe('acc-1');
    expect(rule.categoryId).toBe('cat-1');
  });

  it('seedAppSettings defaults to a fresh-install settings singleton', () => {
    expect(seedAppSettings()).toEqual({
      id: 'settings',
      lastSyncDate: null,
      webauthnCredential: null,
      ignoredExternalAccounts: [],
      exportEncryptionDefault: false,
      passwordHash: null,
      biometricsEnabled: false,
    });
  });
});
