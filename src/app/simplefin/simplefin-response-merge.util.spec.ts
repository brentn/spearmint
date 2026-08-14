import { describe, expect, it } from 'vitest';
import { mergeAccountSets } from './simplefin-response-merge.util';
import type { SimplefinAccountSet } from './simplefin-protocol';

function accountSet(overrides: Partial<SimplefinAccountSet>): SimplefinAccountSet {
  return { errlist: [], connections: [], accounts: [], ...overrides };
}

describe('mergeAccountSets', () => {
  it('flattens errlist entries across all sets', () => {
    const merged = mergeAccountSets([
      accountSet({ errlist: [{ code: 'con.auth', msg: 'a' }] }),
      accountSet({ errlist: [{ code: 'act.notfound', msg: 'b' }] }),
    ]);
    expect(merged.errlist).toEqual([
      { code: 'con.auth', msg: 'a' },
      { code: 'act.notfound', msg: 'b' },
    ]);
  });

  it('dedupes connections by conn_id', () => {
    const conn = { conn_id: 'CON-1', name: 'n', org_id: 'org-1', org_name: 'Bank', org_url: null };
    const merged = mergeAccountSets([
      accountSet({ connections: [conn] }),
      accountSet({ connections: [conn] }),
    ]);
    expect(merged.connections).toHaveLength(1);
  });

  it('unions transactions for the same account id across chunks without duplicating overlap', () => {
    const merged = mergeAccountSets([
      accountSet({
        accounts: [
          {
            id: 'acc-1',
            name: 'Checking',
            currency: 'USD',
            balance: '100.00',
            'balance-date': 1000,
            conn_id: 'CON-1',
            transactions: [
              { id: 'txn-1', posted: 900, amount: '-5.00', description: 'A' },
              { id: 'txn-2', posted: 950, amount: '-6.00', description: 'B' },
            ],
          },
        ],
      }),
      accountSet({
        accounts: [
          {
            id: 'acc-1',
            name: 'Checking',
            currency: 'USD',
            balance: '100.00',
            'balance-date': 1000,
            conn_id: 'CON-1',
            // txn-2 overlaps with the first chunk (7-day overlap window); txn-3 is new.
            transactions: [
              { id: 'txn-2', posted: 950, amount: '-6.00', description: 'B' },
              { id: 'txn-3', posted: 800, amount: '-7.00', description: 'C' },
            ],
          },
        ],
      }),
    ]);

    expect(merged.accounts).toHaveLength(1);
    const ids = merged.accounts[0].transactions.map((t) => t.id).sort();
    expect(ids).toEqual(['txn-1', 'txn-2', 'txn-3']);
  });

  it('keeps the first-seen balance for a repeated account id', () => {
    const merged = mergeAccountSets([
      accountSet({
        accounts: [
          {
            id: 'acc-1',
            name: 'Checking',
            currency: 'USD',
            balance: '100.00',
            'balance-date': 1000,
            conn_id: 'CON-1',
            transactions: [],
          },
        ],
      }),
      accountSet({
        accounts: [
          {
            id: 'acc-1',
            name: 'Checking',
            currency: 'USD',
            balance: '999.00',
            'balance-date': 2000,
            conn_id: 'CON-1',
            transactions: [],
          },
        ],
      }),
    ]);

    expect(merged.accounts[0].balance).toBe('100.00');
  });

  it('keeps distinct accounts separate', () => {
    const merged = mergeAccountSets([
      accountSet({
        accounts: [
          { id: 'acc-1', name: 'A', currency: 'USD', balance: '1', 'balance-date': 1, conn_id: 'CON-1', transactions: [] },
          { id: 'acc-2', name: 'B', currency: 'USD', balance: '2', 'balance-date': 1, conn_id: 'CON-1', transactions: [] },
        ],
      }),
    ]);
    expect(merged.accounts.map((a) => a.id).sort()).toEqual(['acc-1', 'acc-2']);
  });
});
