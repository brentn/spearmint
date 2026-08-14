import type { Account, DateOnly, IgnoredExternalAccount, Institution } from '../data/models';
import { epochSecondsToDateOnly, parseDecimalAmount } from './simplefin-mapping.util';
import type { SimplefinAccount, SimplefinAccountSet, SimplefinError, SimplefinTransaction } from './simplefin-protocol';

/** The composite key `IgnoredExternalAccount` and the permanent-ignore lookup are keyed by. */
export function externalAccountKey(connId: string, externalAccountId: string): string {
  return `${connId}:${externalAccountId}`;
}

/** A SimpleFIN account id seen in a sync response that isn't tracked, remapped, or ignored. */
export interface DiscoveredSimplefinAccount {
  connId: string;
  externalAccountId: string;
  name: string;
  orgId: string;
  orgName: string;
  currencyCode: string;
  balance: string; // raw decimal string — parsed on Add
  balanceDateEpoch: number;
}

export interface AccountSyncData {
  currencyCode: string;
  balance: number;
  balanceDate: DateOnly;
  postedTransactions: SimplefinTransaction[];
  pendingTransactions: SimplefinTransaction[];
}

export interface AccountSyncOutcome {
  accountId: string; // internal Account.id
  needsReconnect: boolean;
  syncIssue: string | null;
  missing: boolean;
  /** Set when this account's externalAccountId changed via a same-connection name match this run. */
  remappedExternalAccountId: string | null;
  /** Present only when a response account was matched (directly or via remap) this run. */
  data: AccountSyncData | null;
}

export interface IngestPlan {
  outcomes: AccountSyncOutcome[];
  discovered: DiscoveredSimplefinAccount[];
  institutions: Institution[];
}

function errorMatchesAccount(error: SimplefinError, externalAccountId: string, connId: string): boolean {
  if (error.account_id) {
    return error.account_id === externalAccountId;
  }
  return error.conn_id === connId;
}

function buildMatchedOutcome(
  account: Account,
  response: SimplefinAccount,
  errlist: SimplefinError[],
  remappedExternalAccountId: string | null
): AccountSyncOutcome {
  const relevantErrors = errlist.filter((e) => errorMatchesAccount(e, response.id, response.conn_id));
  const authError = relevantErrors.find((e) => e.code === 'con.auth');
  const otherError = relevantErrors.find((e) => e.code !== 'con.auth');

  return {
    accountId: account.id,
    needsReconnect: !!authError,
    syncIssue: otherError?.msg ?? null,
    missing: false,
    remappedExternalAccountId,
    data: {
      currencyCode: response.currency,
      balance: parseDecimalAmount(response.balance),
      balanceDate: epochSecondsToDateOnly(response['balance-date']),
      postedTransactions: response.transactions.filter((t) => !t.pending),
      pendingTransactions: response.transactions.filter((t) => t.pending),
    },
  };
}

/**
 * Reconciles this app's tracked Accounts against a merged SimpleFIN sync response:
 * direct id match, same-connection name-match remap when the id changed, "missing" when
 * neither applies, the con.auth / other-error taxonomy (spec §3), and new-account
 * discovery for response accounts nobody claimed. Pure and RxDB-free by design — all the
 * actual reconciliation policy lives here so it can be tested without a database.
 */
export function planIngest(
  trackedAccounts: Account[],
  merged: SimplefinAccountSet,
  ignoredExternalAccounts: IgnoredExternalAccount[]
): IngestPlan {
  const ignoredKeys = new Set(ignoredExternalAccounts.map((i) => i.key));
  const responseById = new Map(merged.accounts.map((a) => [a.id, a]));
  const claimedExternalIds = new Set<string>();

  const directMatches = new Map<string, SimplefinAccount>();
  for (const account of trackedAccounts) {
    const response = responseById.get(account.externalAccountId);
    if (response && response.conn_id === account.connId) {
      directMatches.set(account.id, response);
      claimedExternalIds.add(response.id);
    }
  }

  const outcomes: AccountSyncOutcome[] = [];
  for (const account of trackedAccounts) {
    const response = directMatches.get(account.id);
    if (response) {
      outcomes.push(buildMatchedOutcome(account, response, merged.errlist, null));
      continue;
    }

    const authError = merged.errlist.find(
      (e) => e.code === 'con.auth' && errorMatchesAccount(e, account.externalAccountId, account.connId)
    );
    if (authError) {
      outcomes.push({
        accountId: account.id,
        needsReconnect: true,
        syncIssue: null,
        missing: false,
        remappedExternalAccountId: null,
        data: null,
      });
      continue;
    }

    const remapCandidates = merged.accounts.filter(
      (a) =>
        a.conn_id === account.connId &&
        a.name === account.originalAccountName &&
        !claimedExternalIds.has(a.id)
    );
    if (remapCandidates.length === 1) {
      const candidate = remapCandidates[0];
      claimedExternalIds.add(candidate.id);
      outcomes.push(buildMatchedOutcome(account, candidate, merged.errlist, candidate.id));
    } else {
      outcomes.push({
        accountId: account.id,
        needsReconnect: false,
        syncIssue: null,
        missing: true,
        remappedExternalAccountId: null,
        data: null,
      });
    }
  }

  const discovered: DiscoveredSimplefinAccount[] = [];
  for (const response of merged.accounts) {
    if (claimedExternalIds.has(response.id)) {
      continue;
    }
    if (ignoredKeys.has(externalAccountKey(response.conn_id, response.id))) {
      continue;
    }
    const connection = merged.connections?.find((c) => c.conn_id === response.conn_id);
    discovered.push({
      connId: response.conn_id,
      externalAccountId: response.id,
      name: response.name,
      orgId: connection?.org_id ?? response.conn_id,
      orgName: connection?.org_name ?? 'Unknown institution',
      currencyCode: response.currency,
      balance: response.balance,
      balanceDateEpoch: response['balance-date'],
    });
  }

  const institutions: Institution[] = (merged.connections ?? []).map((c) => ({
    id: c.org_id,
    name: c.org_name,
    url: c.org_url,
  }));

  return { outcomes, discovered, institutions };
}
