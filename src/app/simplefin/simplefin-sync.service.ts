import { Injectable, inject, signal } from '@angular/core';
import type { AccountType, Transaction } from '../data/models';
import { getAppSettingsDoc, upsertAppSettings } from '../data/app-settings.util';
import { DatabaseService, type SpearmintDatabase } from '../data/database.service';
import { CategorizationRulesService } from '../categorization/categorization-rules.service';
import { CategorizationSuggestionsService } from '../categorization/categorization-suggestions.service';
import { epochSecondsToDateOnly, parseDecimalAmount } from './simplefin-mapping.util';
import { SimplefinApiService } from './simplefin-api.service';
import { SimplefinLinkService } from './simplefin-link.service';
import {
  externalAccountKey,
  planIngest,
  toDiscoveredAccount,
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
): Transaction[] {
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
  private readonly categorizationRules = inject(CategorizationRulesService);
  private readonly categorizationSuggestions = inject(CategorizationSuggestionsService);

  readonly syncing = signal(false);
  readonly lastSyncError = signal<string | null>(null);
  readonly discoveredAccounts = signal<DiscoveredSimplefinAccount[]>([]);

  private lastMergedSet: SimplefinAccountSet | null = null;
  private readonly pendingAdds = new Set<string>();

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

      // Manual accounts (issue #37) have no live SimpleFIN identity — excluding them here
      // means planIngest never builds an outcome for one, so a sync run can't touch,
      // error on, or flag needsReconnect/syncIssue/missing on it.
      const trackedAccounts = (await db.accounts.find().exec())
        .map((doc) => doc.toJSON())
        .filter((account) => !account.isManual);
      const plan = planIngest(trackedAccounts, merged, settingsDoc?.ignoredExternalAccounts ?? []);

      for (const institution of plan.institutions) {
        await db.institutions.upsert(institution);
      }
      for (const outcome of plan.outcomes) {
        await this.applyOutcome(db, outcome);
      }
      this.discoveredAccounts.set(plan.discovered);

      await upsertAppSettings(db, { lastSyncDate: today });

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
    const key = externalAccountKey(discovered.connId, discovered.externalAccountId);
    // Guards against double-adding the same external account (e.g. a double-click firing
    // two overlapping calls before the first one's insert clears it from discoveredAccounts).
    // Checked and claimed synchronously, before any await, so a second concurrent call for
    // the same key can never slip through the gap a plain "does it exist yet" DB check leaves.
    if (this.pendingAdds.has(key)) {
      return;
    }
    this.pendingAdds.add(key);
    try {
      const db = await this.databaseService.getDatabase();
      const existing = await db.accounts
        .findOne({ selector: { connId: discovered.connId, externalAccountId: discovered.externalAccountId } })
        .exec();
      if (existing) {
        this.removeDiscovered(discovered);
        return;
      }

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
        isManual: false,
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
    } finally {
      this.pendingAdds.delete(key);
    }
  }

  async ignoreDiscoveredAccount(discovered: DiscoveredSimplefinAccount): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const key = externalAccountKey(discovered.connId, discovered.externalAccountId);
    const entry = { key, name: discovered.name, institutionName: discovered.orgName };
    const settingsDoc = await getAppSettingsDoc(db);
    if (!settingsDoc?.ignoredExternalAccounts.some((i) => i.key === key)) {
      await upsertAppSettings(db, { ignoredExternalAccounts: [...(settingsDoc?.ignoredExternalAccounts ?? []), entry] });
    }
    this.removeDiscovered(discovered);
  }

  /** Reverses ignoreDiscoveredAccount: restores the entry to discoveredAccounts from the
   * last sync response if one has landed this session, else falls back to a full resync
   * (e.g. the account was ignored in an earlier session and nothing has synced yet). */
  async unignoreDiscoveredAccount(key: string): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const settingsDoc = await getAppSettingsDoc(db);
    if (!settingsDoc) {
      return;
    }
    await settingsDoc.incrementalPatch({
      ignoredExternalAccounts: settingsDoc.ignoredExternalAccounts.filter((i) => i.key !== key),
    });

    const response = this.lastMergedSet?.accounts.find(
      (a) => externalAccountKey(a.conn_id, a.id) === key
    );
    if (!response) {
      await this.syncNow();
      return;
    }
    this.discoveredAccounts.update((list) => [...list, toDiscoveredAccount(response, this.lastMergedSet?.connections)]);
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

  /** Never re-categorizes an already-known id — only mutable fields are patched. New ids are
   * run once through the auto-categorization heuristic before insert (spec §3.1/§3). */
  private async upsertPostedTransactions(
    db: SpearmintDatabase,
    accountId: string,
    transactions: SimplefinTransaction[]
  ): Promise<void> {
    const newDrafts: Transaction[] = [];
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
        newDrafts.push(draft);
      }
    }
    await this.categorizeAndInsert(db, accountId, newDrafts);
  }

  /** Pending rows are fully transient: wiped and replaced every sync, never upserted — each
   * fresh row is run through the auto-categorization heuristic again (spec §3.1/§3). */
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
    await this.categorizeAndInsert(db, accountId, drafts);
  }

  /** Applies the three-tier outcome (spec §3.1) to a batch of not-yet-persisted drafts for one
   * account, fetching that account's CategorizationRules once, then bulk-inserts the result:
   * auto-apply tier sets categoryId directly; the suggestion tier is recorded separately
   * (session-scoped, not part of the RxDB write) rather than mutating categoryId. */
  private async categorizeAndInsert(db: SpearmintDatabase, accountId: string, drafts: Transaction[]): Promise<void> {
    if (drafts.length === 0) {
      return;
    }
    const outcomes = await this.categorizationRules.classifyMany(accountId, drafts);
    const finalDrafts = drafts.map((draft) => {
      const outcome = outcomes.get(draft.id);
      if (!outcome) {
        return draft;
      }
      if (outcome.tier === 'auto') {
        return { ...draft, categoryId: outcome.categoryId };
      }
      if (outcome.tier === 'suggest' && outcome.categoryId) {
        this.categorizationSuggestions.set(draft.id, outcome.categoryId);
      }
      return draft;
    });
    await db.transactions.bulkInsert(finalDrafts);
  }
}
