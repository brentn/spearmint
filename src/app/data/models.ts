// Domain model — locked in the rebuild spec (.scratch/spearmint-rebuild/assets/19-spearmint-rebuild-spec.md §1).

import type { ExtendedAuthenticatorTransport, NamedAlgo } from '@passwordless-id/webauthn';

export type DateOnly = string; // YYYY-MM-DD
export type UtcTimestamp = string; // ISO 8601
export type PeriodType = 'month' | 'year';
export type YearMonth = string; // YYYY-MM

export interface Institution {
  id: string; // = SimpleFIN's org_id
  name: string;
  url: string | null;
}

export type AccountType = 'bank' | 'creditCard';

export interface Account {
  id: string;
  institutionId: string;
  connId: string;
  externalAccountId: string;
  originalAccountName: string;
  name: string;
  type: AccountType;
  currencyCode: string;
  balance: number;
  balanceDate: DateOnly;
  needsReconnect: boolean;
  syncIssue: string | null;
  missing: boolean;
}

export type CategoryType = 'expense' | 'income' | 'transfer';

export interface Category {
  id: string;
  name: string;
  parentCategoryId: string | null;
  type: CategoryType;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: DateOnly;
  description: string;
  amount: number;
  pending: boolean;
  categoryId: string | null;
  excludeFromBudget: boolean;
  notes: string | null;
}

export interface Budget {
  id: string;
  categoryId: string;
  periodType: PeriodType;
  period: YearMonth;
  rollOver: boolean;
  rolloverAmount?: number;
  amount: number;
}

export interface CategorizationRule {
  id: string;
  accountId: string;
  normalizedDescription: string;
  amount: number;
  dayOfMonth: number;
  categoryId: string;
  createdAtUtc: UtcTimestamp;
  updatedAtUtc: UtcTimestamp;
}

/**
 * A local WebAuthn credential, sufficient to verify a signature fully client-side
 * (id + publicKey + algorithm, per @passwordless-id/webauthn's server.verifyAuthentication).
 * A refinement of the spec's `webauthnCredentialId: string` field — a bare id can't
 * verify a signature without the public key, so the full credential is stored here.
 */
export interface WebauthnCredential {
  id: string;
  publicKey: string;
  algorithm: NamedAlgo;
  transports: ExtendedAuthenticatorTransport[];
}

/**
 * A permanently-ignored SimpleFIN discovery, identified by its `${connId}:${externalAccountId}`
 * composite key. Carries the name/institution seen at ignore time so the Ignored accounts list
 * can label entries without re-fetching a discovery record that no longer exists post-ignore.
 */
export interface IgnoredExternalAccount {
  key: string;
  name: string;
  institutionName: string;
}

/**
 * A PBKDF2-SHA256 hash of the app-unlock password, both base64-encoded — see
 * `password-hash.util.ts`. The iteration count is a fixed in-code constant,
 * not stored per-password.
 */
export interface PasswordHash {
  salt: string;
  hash: string;
}

export interface AppSettings {
  id: 'settings'; // singleton document
  lastSyncDate: DateOnly | null;
  webauthnCredential: WebauthnCredential | null;
  ignoredExternalAccounts: IgnoredExternalAccount[];
  exportEncryptionDefault: boolean;
  /** Password-primary login (issue #25): null until a password has been created. */
  passwordHash: PasswordHash | null;
  /** Whether WebAuthn is offered as a faster 2nd-step alongside the password.
   * Migrated on for anyone who already had a `webauthnCredential` pre-upgrade. */
  biometricsEnabled: boolean;
}

/**
 * A claimed SimpleFIN setup token, resolved to an access URL. Not itself part of the
 * spec's §1 domain model (which deliberately has no Connection entity) — this exists
 * one level below that: the credential used to call SimpleFIN's API at all. A user can
 * claim more than one token over time (the Connect-a-bank screen is reused for adding
 * further connections), and each claim may resolve to a distinct access URL, so a sync
 * run walks every stored link rather than assuming exactly one.
 */
export interface SimplefinLink {
  id: string;
  accessUrl: string; // plaintext, embeds Basic Auth credentials — see AppSettings storage note in spec §3
  claimedAtUtc: UtcTimestamp;
}
