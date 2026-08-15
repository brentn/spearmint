import { describe, expect, it } from 'vitest';
import type { Account } from '../data/models';
import { planIngest } from './simplefin-ingest-plan.util';
import type { SimplefinAccount, SimplefinAccountSet, SimplefinConnection } from './simplefin-protocol';

function account(overrides: Partial<Account>): Account {
  return {
    id: 'acc-internal-1',
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

function simplefinAccount(overrides: Partial<SimplefinAccount>): SimplefinAccount {
  return {
    id: 'ext-1',
    name: 'Checking',
    currency: 'USD',
    balance: '113.51',
    'balance-date': 1786608000,
    conn_id: 'CON-1',
    transactions: [],
    ...overrides,
  };
}

const connection: SimplefinConnection = {
  conn_id: 'CON-1',
  name: 'My Bank Link',
  org_id: 'org-1',
  org_name: 'My Bank',
  org_url: 'https://mybank.example',
};

function set(overrides: Partial<SimplefinAccountSet>): SimplefinAccountSet {
  return { errlist: [], connections: [connection], accounts: [], ...overrides };
}

describe('planIngest', () => {
  it('syncs balance and splits posted/pending transactions for a direct id match', () => {
    const tracked = account({});
    const response = simplefinAccount({
      balance: '250.75',
      'balance-date': 1786608000,
      transactions: [
        { id: 'txn-posted', posted: 1786521600, amount: '-10.00', description: 'Coffee', pending: false },
        { id: 'txn-pending', posted: 1786608000, amount: '-3.00', description: 'Gas', pending: true },
      ],
    });

    const plan = planIngest([tracked], set({ accounts: [response] }), []);

    expect(plan.outcomes).toHaveLength(1);
    const outcome = plan.outcomes[0];
    expect(outcome.accountId).toBe(tracked.id);
    expect(outcome.missing).toBe(false);
    expect(outcome.needsReconnect).toBe(false);
    expect(outcome.syncIssue).toBeNull();
    expect(outcome.remappedExternalAccountId).toBeNull();
    expect(outcome.data?.balance).toBe(250.75);
    expect(outcome.data?.postedTransactions.map((t) => t.id)).toEqual(['txn-posted']);
    expect(outcome.data?.pendingTransactions.map((t) => t.id)).toEqual(['txn-pending']);
  });

  it('flags needsReconnect on a con.auth error scoped to the account, without data', () => {
    const tracked = account({});
    const plan = planIngest(
      [tracked],
      set({ errlist: [{ code: 'con.auth', msg: 'Reauth required', conn_id: 'CON-1', account_id: 'ext-1' }] }),
      []
    );

    const outcome = plan.outcomes[0];
    expect(outcome.needsReconnect).toBe(true);
    expect(outcome.missing).toBe(false);
    expect(outcome.data).toBeNull();
  });

  it('flags needsReconnect for every account under a connection-scoped con.auth error (no account_id)', () => {
    const tracked1 = account({ id: 'acc-1', externalAccountId: 'ext-1' });
    const tracked2 = account({ id: 'acc-2', externalAccountId: 'ext-2' });
    const plan = planIngest(
      [tracked1, tracked2],
      set({ errlist: [{ code: 'con.auth', msg: 'Reauth required', conn_id: 'CON-1' }] }),
      []
    );

    expect(plan.outcomes.every((o) => o.needsReconnect)).toBe(true);
  });

  it('flags needsReconnect when errlist conn_id is a bare suffix of the account/response conn_id (MX-backed bridge quirk)', () => {
    const trackedMatched = account({ id: 'acc-1', connId: 'MX-MBR-1', externalAccountId: 'ext-1' });
    const trackedUnmatched = account({ id: 'acc-2', connId: 'MX-MBR-1', externalAccountId: 'ext-2' });
    const plan = planIngest(
      [trackedMatched, trackedUnmatched],
      set({
        errlist: [{ code: 'con.auth', msg: 'Auth required', conn_id: 'MBR-1' }],
        accounts: [simplefinAccount({ id: 'ext-1', conn_id: 'MX-MBR-1' })],
      }),
      []
    );

    expect(plan.outcomes.find((o) => o.accountId === 'acc-1')?.needsReconnect).toBe(true);
    expect(plan.outcomes.find((o) => o.accountId === 'acc-2')?.needsReconnect).toBe(true);
  });

  it('does not let a con.auth error on a different connection affect this account', () => {
    const tracked = account({ connId: 'CON-1', externalAccountId: 'ext-1' });
    const plan = planIngest(
      [tracked],
      set({ errlist: [{ code: 'con.auth', msg: 'Reauth required', conn_id: 'CON-OTHER' }] }),
      []
    );

    // No auth error applies, no response account either -> falls through to missing.
    expect(plan.outcomes[0].needsReconnect).toBe(false);
    expect(plan.outcomes[0].missing).toBe(true);
  });

  it('surfaces a non-auth con./act. error verbatim as syncIssue while still syncing data', () => {
    const tracked = account({});
    const response = simplefinAccount({});
    const plan = planIngest(
      [tracked],
      set({
        accounts: [response],
        errlist: [{ code: 'act.notfound', msg: 'Account temporarily unavailable', account_id: 'ext-1' }],
      }),
      []
    );

    const outcome = plan.outcomes[0];
    expect(outcome.syncIssue).toBe('Account temporarily unavailable');
    expect(outcome.needsReconnect).toBe(false);
    expect(outcome.data).not.toBeNull();
  });

  it('flags missing when the tracked externalAccountId is absent and no name match exists', () => {
    const tracked = account({ externalAccountId: 'ext-gone', originalAccountName: 'Old Savings' });
    const plan = planIngest([tracked], set({ accounts: [] }), []);

    expect(plan.outcomes[0].missing).toBe(true);
    expect(plan.outcomes[0].data).toBeNull();
  });

  it('remaps to an unclaimed same-connection account with a matching original name', () => {
    const tracked = account({ externalAccountId: 'ext-old', originalAccountName: 'Checking', connId: 'CON-1' });
    const renamed = simplefinAccount({ id: 'ext-new', name: 'Checking', conn_id: 'CON-1' });
    const plan = planIngest([tracked], set({ accounts: [renamed] }), []);

    const outcome = plan.outcomes[0];
    expect(outcome.missing).toBe(false);
    expect(outcome.remappedExternalAccountId).toBe('ext-new');
    expect(outcome.data).not.toBeNull();
  });

  it('does not remap across a different connection even with a matching name', () => {
    const tracked = account({ externalAccountId: 'ext-old', originalAccountName: 'Checking', connId: 'CON-1' });
    const otherConn = simplefinAccount({ id: 'ext-new', name: 'Checking', conn_id: 'CON-OTHER' });
    const plan = planIngest([tracked], set({ accounts: [otherConn] }), []);

    expect(plan.outcomes[0].missing).toBe(true);
  });

  it('falls back to missing when two unclaimed accounts share the original name (ambiguous)', () => {
    const tracked = account({ externalAccountId: 'ext-old', originalAccountName: 'Checking', connId: 'CON-1' });
    const candidateA = simplefinAccount({ id: 'ext-a', name: 'Checking', conn_id: 'CON-1' });
    const candidateB = simplefinAccount({ id: 'ext-b', name: 'Checking', conn_id: 'CON-1' });
    const plan = planIngest([tracked], set({ accounts: [candidateA, candidateB] }), []);

    expect(plan.outcomes[0].missing).toBe(true);
    expect(plan.outcomes[0].remappedExternalAccountId).toBeNull();
  });

  it('does not offer an already-claimed account id as a remap target', () => {
    const claimed = account({ id: 'acc-claimed', externalAccountId: 'ext-1', connId: 'CON-1' });
    const orphaned = account({
      id: 'acc-orphaned',
      externalAccountId: 'ext-gone',
      originalAccountName: 'Checking',
      connId: 'CON-1',
    });
    const responseAccount = simplefinAccount({ id: 'ext-1', name: 'Checking', conn_id: 'CON-1' });
    const plan = planIngest([claimed, orphaned], set({ accounts: [responseAccount] }), []);

    const orphanedOutcome = plan.outcomes.find((o) => o.accountId === 'acc-orphaned')!;
    expect(orphanedOutcome.missing).toBe(true);
  });

  it('surfaces an unclaimed response account as discovered, keyed by connId + external id', () => {
    const newAccount = simplefinAccount({ id: 'ext-new', name: 'New Savings', conn_id: 'CON-1' });
    const plan = planIngest([], set({ accounts: [newAccount] }), []);

    expect(plan.discovered).toHaveLength(1);
    expect(plan.discovered[0]).toMatchObject({
      connId: 'CON-1',
      externalAccountId: 'ext-new',
      name: 'New Savings',
      orgId: 'org-1',
      orgName: 'My Bank',
    });
  });

  it('excludes a discovered account already on the permanent ignore list', () => {
    const newAccount = simplefinAccount({ id: 'ext-new', name: 'New Savings', conn_id: 'CON-1' });
    const plan = planIngest(
      [],
      set({ accounts: [newAccount] }),
      [{ key: 'CON-1:ext-new', name: 'New Savings', institutionName: 'My Bank' }]
    );

    expect(plan.discovered).toHaveLength(0);
  });

  it('does not surface a remap target or a directly-claimed account as discovered', () => {
    const tracked = account({ externalAccountId: 'ext-1', connId: 'CON-1' });
    const response = simplefinAccount({ id: 'ext-1', conn_id: 'CON-1' });
    const plan = planIngest([tracked], set({ accounts: [response] }), []);

    expect(plan.discovered).toHaveLength(0);
  });

  it('builds an Institution per connection from org_id/org_name/org_url', () => {
    const plan = planIngest([], set({ accounts: [] }), []);
    expect(plan.institutions).toEqual([{ id: 'org-1', name: 'My Bank', url: 'https://mybank.example' }]);
  });
});
