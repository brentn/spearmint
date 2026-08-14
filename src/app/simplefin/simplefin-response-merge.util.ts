import type { SimplefinAccount, SimplefinAccountSet, SimplefinConnection } from './simplefin-protocol';

function mergeAccounts(sets: SimplefinAccountSet[]): SimplefinAccount[] {
  const byId = new Map<string, SimplefinAccount>();
  const transactionIdsById = new Map<string, Set<string>>();

  for (const set of sets) {
    for (const account of set.accounts) {
      const existing = byId.get(account.id);
      if (!existing) {
        byId.set(account.id, { ...account, transactions: [...account.transactions] });
        transactionIdsById.set(account.id, new Set(account.transactions.map((t) => t.id)));
        continue;
      }
      // balance/balance-date aren't window-dependent (always "current" as of the
      // request), so every chunk reports the same value — first occurrence wins,
      // only transactions need merging across chunks.
      const seenIds = transactionIdsById.get(account.id)!;
      for (const transaction of account.transactions) {
        if (!seenIds.has(transaction.id)) {
          seenIds.add(transaction.id);
          existing.transactions.push(transaction);
        }
      }
    }
  }
  return [...byId.values()];
}

function mergeConnections(sets: SimplefinAccountSet[]): SimplefinConnection[] {
  const byId = new Map<string, SimplefinConnection>();
  for (const set of sets) {
    for (const connection of set.connections ?? []) {
      byId.set(connection.conn_id, connection);
    }
  }
  return [...byId.values()];
}

/**
 * A sync run issues one SimpleFIN request per <=45-day chunk (sync-window.util.ts) per
 * stored access URL. This flattens all of those responses into a single account set, so
 * the rest of the ingest pipeline never has to think about chunking.
 */
export function mergeAccountSets(sets: SimplefinAccountSet[]): SimplefinAccountSet {
  return {
    errlist: sets.flatMap((s) => s.errlist),
    connections: mergeConnections(sets),
    accounts: mergeAccounts(sets),
  };
}
