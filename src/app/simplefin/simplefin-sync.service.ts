import { Injectable, inject, signal } from '@angular/core';
import type { AccountType } from '../data/models';
import { DEFAULT_APP_SETTINGS, getAppSettingsDoc } from '../data/app-settings.util';
import { DatabaseService, type SpearmintDatabase } from '../data/database.service';
import { epochSecondsToDateOnly, parseDecimalAmount } from './simplefin-mapping.util';
import { SimplefinApiService } from './simplefin-api.service';
import { SimplefinLinkService } from './simplefin-link.service';
import {
  planIngest,
  type AccountSyncOutcome,
  type DiscoveredSimplefinAccount,
} from './simplefin-ingest-plan.util';
import { mergeAccountSets } from './simplefin-response-merge.util';
import type { SimplefinAccountSet, SimplefinTransaction } from './simplefin-protocol';
import { computeSyncWindows } from './sync-window.util';
import { todayDateOnlyUtc } from './date-only.util';

export interface SyncResult {
  success: boolean;
  error: string | null;
}

function toDraftTransactions(
  accountId: string,
  transactions: SimplefinTransaction[],
  pending: boolean
) {
  return transactions.map((t) => ({
    id: t.id,
    accountId,
    date: epochSecondsToDateOnly(t.posted),
    description: t.description,
    amount: parseDecimalAmount(t.amount),
    pending,
    categoryId: null,
    excludeFromBudget: false,
    notes: null,
  }));
}

/**
 * Orchestrates SimpleFIN sync runs: fetches every stored access URL's chunked date
 * windows, reconciles the response against tracked accounts via planIngest (spec §3),
 * and applies the result to RxDB. lastSyncDate only advances when every request in the
 * run succeeds — a per-account error (needsReconnect/syncIssue/missing) is not a
 * whole-run failure, but a network/quota failure on any request is.
 */
@Injectable({ providedIn: 'root' })
export class SimplefinSyncService {
  private readonly databaseService = inject(DatabaseService);
  private readonly api = inject(SimplefinApiService);
  private readonly linkService = inject(SimplefinLinkService);

  readonly syncing = signal(false);
  readonly lastSyncError = signal<string | null>(null);
  readonly discoveredAccounts = signal<DiscoveredSimplefinAccount[]>([]);

  private lastMergedSet: SimplefinAccountSet | null = null;

  async runAutoSyncIfDue(): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const settings = await getAppSettingsDoc(db);
    if (settings?.lastSyncDate === todayDateOnlyUtc()) {
      return;
    }
    await this.syncNow();
  }

  async syncNow(): Promise<SyncResult> {
    this.syncing.set(true);
    this.lastSyncError.set(null);
    try {
      const db = await this.databaseService.getDatabase();
      const accessUrls = await this.linkService.getAllAccessUrls();
      if (accessUrls.length === 0) {
        return { success: true, error: null };
      }

      const settingsDoc = await getAppSettingsDoc(db);
      const lastSyncDate = settingsDoc?.lastSyncDate ?? null;
      const today = todayDateOnlyUtc();
      const windows = computeSyncWindows(lastSyncDate, today);

      const responseSets: SimplefinAccountSet[] = [];
      for (const accessUrl of accessUrls) {
        for (const window of windows) {
          responseSets.push(await this.api.fetchAccounts(accessUrl, window));
        }
      }

      const merged = mergeAccountSets(responseSets);
      this.lastMergedSet = merged;

      const trackedAccounts = (await db.accounts.find().exec()).map((doc) => doc.toJSON());
      const plan = planIngest(trackedAccounts, merged, settingsDoc?.ignoredExternalAccounts ?? []);

      for (const institution of plan.institutions) {
        await db.institutions.upsert(institution);
      }
      for (const outcome of plan.outcomes) {
        await this.applyOutcome(db, outcome);
      }
      this.discoveredAccounts.set(plan.discovered);

      if (settingsDoc) {
        await settingsDoc.incrementalPatch({ lastSyncDate: today });
      } else {
        await db.appSettings.insert({ ...DEFAULT_APP_SETTINGS, lastSyncDate: today, webauthnCredential: null });
      }

      return { success: true, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed.';
      this.lastSyncError.set(message);
      return { success: false, error: message };
    } finally {
      this.syncing.set(false);
    }
  }

  async addDiscoveredAccount(discovered: DiscoveredSimplefinAccount, type: AccountType): Promise<void> {
    const db = await this.databaseService.getDatabase();
    await db.institutions.upsert({ id: discovered.orgId, name: discovered.orgName, url: null });

    const accountId = crypto.randomUUID();
    await db.accounts.insert({
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
      needsReconnect: false,
      syncIssue: null,
      missing: false,
    });

    const response = this.lastMergedSet?.accounts.find(
      (a) => a.id === discovered.externalAccountId && a.conn_id === discovered.connId
    );
    if (response) {
      const posted = response.transactions.filter((t) => !t.pending);
      const pending = response.transactions.filter((t) => t.pending);
      await this.upsertPostedTransactions(db, accountId, posted);
      await this.replacePendingTransactions(db, accountId, pending);
    }

    this.removeDiscovered(discovered);
  }

  async ignoreDiscoveredAccount(discovered: DiscoveredSimplefinAccount): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const key = `${discovered.connId}:${discovered.externalAccountId}`;
    const settingsDoc = await getAppSettingsDoc(db);
    if (settingsDoc) {
      if (!settingsDoc.ignoredExternalAccounts.includes(key)) {
        await settingsDoc.incrementalPatch({
          ignoredExternalAccounts: [...settingsDoc.ignoredExternalAccounts, key],
        });
      }
    } else {
      await db.appSettings.insert({ ...DEFAULT_APP_SETTINGS, webauthnCredential: null, ignoredExternalAccounts: [key] });
    }
    this.removeDiscovered(discovered);
  }

  private removeDiscovered(discovered: DiscoveredSimplefinAccount): void {
    this.discoveredAccounts.update((list) =>
      list.filter((d) => !(d.connId === discovered.connId && d.externalAccountId === discovered.externalAccountId))
    );
  }

  private async applyOutcome(db: SpearmintDatabase, outcome: AccountSyncOutcome): Promise<void> {
    const doc = await db.accounts.findOne(outcome.accountId).exec();
    if (!doc) {
      return;
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

    if (outcome.data) {
      await this.upsertPostedTransactions(db, outcome.accountId, outcome.data.postedTransactions);
      await this.replacePendingTransactions(db, outcome.accountId, outcome.data.pendingTransactions);
    }
  }

  /** Never re-categorizes an already-known id — only mutable fields are patched. */
  private async upsertPostedTransactions(
    db: SpearmintDatabase,
    accountId: string,
    transactions: SimplefinTransaction[]
  ): Promise<void> {
    for (const draft of toDraftTransactions(accountId, transactions, false)) {
      const existing = await db.transactions.findOne(draft.id).exec();
      if (existing) {
        await existing.incrementalPatch({
          date: draft.date,
          description: draft.description,
          amount: draft.amount,
          pending: false,
        });
      } else {
        await db.transactions.insert(draft);
      }
    }
  }

  /** Pending rows are fully transient: wiped and replaced every sync, never upserted. */
  private async replacePendingTransactions(
    db: SpearmintDatabase,
    accountId: string,
    transactions: SimplefinTransaction[]
  ): Promise<void> {
    const existingPending = await db.transactions
      .find({ selector: { accountId, pending: true } })
      .exec();
    await Promise.all(existingPending.map((doc) => doc.remove()));

    const drafts = toDraftTransactions(accountId, transactions, true);
    if (drafts.length > 0) {
      await db.transactions.bulkInsert(drafts);
    }
  }
}
