import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../data/database.service';
import type { Account, AccountType, Institution } from '../data/models';
import { todayDateOnlyUtc } from '../simplefin/date-only.util';
import type { AccountSyncOutcome, DiscoveredSimplefinAccount } from '../simplefin/simplefin-ingest-plan.util';
import { epochSecondsToDateOnly, parseDecimalAmount } from '../simplefin/simplefin-mapping.util';

/** Every new Account starts here regardless of which creation path produced it, so a future
 * third path can't forget to zero these. */
const CLEAN_SYNC_STATUS = { needsReconnect: false, syncIssue: null, missing: false } as const;

/**
 * Owns every Account/Institution RxDB write: SimplefinSyncService, the Settings Accounts
 * screen, and AccountDeletionService all route their creates/renames/type-changes/removals
 * through here instead of touching `db.accounts`/`db.institutions` directly, so the "a new
 * account always starts with a clean sync status" invariant lives in one place regardless of
 * which of the two creation paths (manual vs. discovery) produced it.
 */
@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly databaseService = inject(DatabaseService);

  private async findAccountDoc(accountId: string) {
    const db = await this.databaseService.getDatabase();
    return db.accounts.findOne(accountId).exec();
  }

  async findById(accountId: string): Promise<Account | undefined> {
    const doc = await this.findAccountDoc(accountId);
    return doc?.toJSON();
  }

  async findInstitutionById(institutionId: string): Promise<Institution | undefined> {
    const db = await this.databaseService.getDatabase();
    const doc = await db.institutions.findOne(institutionId).exec();
    return doc?.toJSON();
  }

  async upsertInstitution(institution: Institution): Promise<void> {
    const db = await this.databaseService.getDatabase();
    await db.institutions.upsert(institution);
  }

  /** Creates a Manual Account (ADR-0016): a synthetic Institution row for the named bank,
   * plus an Account with no live SimpleFIN identity — `connId`/`externalAccountId` are
   * placeholders unique to this account, never real SimpleFIN ids, so the sync loop's
   * matching logic can never accidentally claim them. Starts at a zero balance; both the
   * balance and its transactions are populated later by a Statement Import. */
  async createManualAccount(bankName: string, accountName: string, type: AccountType): Promise<Account> {
    const db = await this.databaseService.getDatabase();
    const institutionId = crypto.randomUUID();
    await db.institutions.insert({ id: institutionId, name: bankName, url: null });

    const accountId = crypto.randomUUID();
    const account: Account = {
      id: accountId,
      institutionId,
      connId: `manual:${accountId}`,
      externalAccountId: accountId,
      originalAccountName: accountName,
      name: accountName,
      type,
      currencyCode: 'USD',
      balance: 0,
      balanceDate: todayDateOnlyUtc(),
      ...CLEAN_SYNC_STATUS,
      isManual: true,
    };
    await db.accounts.insert(account);
    return account;
  }

  /** Creates a tracked Account from a sync-discovered SimpleFIN account, upserting its
   * Institution row first. Callers ingest any transactions from the same sync response
   * separately — that's transaction, not Account/Institution, state. */
  async createFromDiscovery(discovered: DiscoveredSimplefinAccount, type: AccountType): Promise<Account> {
    const db = await this.databaseService.getDatabase();
    await db.institutions.upsert({ id: discovered.orgId, name: discovered.orgName, url: null });

    const accountId = crypto.randomUUID();
    const account: Account = {
      id: accountId,
      institutionId: discovered.orgId,
      connId: discovered.connId,
      externalAccountId: discovered.externalAccountId,
      originalAccountName: discovered.name,
      name: discovered.name,
      type,
      currencyCode: discovered.currencyCode,
      balance: parseDecimalAmount(discovered.balance),
      balanceDate: epochSecondsToDateOnly(discovered.balanceDateEpoch),
      ...CLEAN_SYNC_STATUS,
      isManual: false,
    };
    await db.accounts.insert(account);
    return account;
  }

  async rename(accountId: string, name: string): Promise<void> {
    const doc = await this.findAccountDoc(accountId);
    await doc?.incrementalPatch({ name });
  }

  async setType(accountId: string, type: AccountType): Promise<void> {
    const doc = await this.findAccountDoc(accountId);
    await doc?.incrementalPatch({ type });
  }

  /** Applies one sync run's outcome for a tracked account (spec §3): the reconnect/issue/
   * missing flags and a remapped externalAccountId always update, but currency/balance/date
   * only when the outcome matched a response account this run. Returns false without writing
   * if the account no longer exists. */
  async applySyncOutcome(outcome: AccountSyncOutcome): Promise<boolean> {
    const doc = await this.findAccountDoc(outcome.accountId);
    if (!doc) {
      return false;
    }
    await doc.incrementalPatch({
      needsReconnect: outcome.needsReconnect,
      syncIssue: outcome.syncIssue,
      missing: outcome.missing,
      ...(outcome.remappedExternalAccountId ? { externalAccountId: outcome.remappedExternalAccountId } : {}),
      ...(outcome.data
        ? {
            currencyCode: outcome.data.currencyCode,
            balance: outcome.data.balance,
            balanceDate: outcome.data.balanceDate,
          }
        : {}),
    });
    return true;
  }

  async remove(accountId: string): Promise<void> {
    const doc = await this.findAccountDoc(accountId);
    await doc?.remove();
  }
}
