import { Injectable, effect, inject, signal } from '@angular/core';
import { AccountDeletionService } from '../../../accounts/account-deletion.service';
import { getAppSettingsDoc } from '../../../data/app-settings.util';
import { DatabaseService } from '../../../data/database.service';
import type { Account, AccountType, IgnoredExternalAccount, Institution } from '../../../data/models';
import { todayDateOnlyUtc } from '../../../simplefin/date-only.util';
import type { DiscoveredSimplefinAccount } from '../../../simplefin/simplefin-ingest-plan.util';
import { SimplefinLinkService } from '../../../simplefin/simplefin-link.service';
import { SimplefinSyncService } from '../../../simplefin/simplefin-sync.service';
import { StatementImportService } from '../../../statement-import/statement-import.service';

/**
 * Screen-scoped store for Settings -> Accounts: loads accounts/institutions from RxDB
 * and re-reads them after every mutating action. Simpler than wiring RxDB's own query
 * reactivity end-to-end, and matches this codebase's existing convention (AuthService)
 * of plain signals refreshed imperatively rather than a live query subscription. Also
 * re-reads whenever a background sync finishes, so opening this screen while a sync is
 * still in flight doesn't leave it stuck showing a stale snapshot.
 */
@Injectable()
export class AccountsStore {
  private readonly databaseService = inject(DatabaseService);
  private readonly linkService = inject(SimplefinLinkService);
  private readonly syncService = inject(SimplefinSyncService);
  private readonly statementImportService = inject(StatementImportService);
  private readonly accountDeletionService = inject(AccountDeletionService);

  readonly loading = signal(true);
  readonly accounts = signal<Account[]>([]);
  readonly institutions = signal<Institution[]>([]);
  readonly ignoredExternalAccounts = signal<IgnoredExternalAccount[]>([]);

  readonly connecting = signal(false);
  readonly connectError = signal<string | null>(null);
  readonly discoveredActionPending = signal(false);

  readonly deletingAccountId = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);

  readonly importingAccountId = signal<string | null>(null);
  /** Sticky across the importingAccountId reset in the `finally` below, so the result/error
   * banner for the account just imported into stays visible once the import finishes. */
  readonly lastImportAccountId = signal<string | null>(null);
  readonly importError = signal<string | null>(null);
  readonly importResultMessage = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!this.syncService.syncing()) {
        void this.refresh();
      }
    });
  }

  institutionName(institutionId: string): string {
    return this.institutions().find((i) => i.id === institutionId)?.name ?? 'Unknown institution';
  }

  async refresh(): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const [accountDocs, institutionDocs, settingsDoc] = await Promise.all([
      db.accounts.find().exec(),
      db.institutions.find().exec(),
      getAppSettingsDoc(db),
    ]);
    this.accounts.set(accountDocs.map((doc) => doc.toJSON()));
    this.institutions.set(institutionDocs.map((doc) => doc.toJSON()));
    this.ignoredExternalAccounts.set(settingsDoc?.ignoredExternalAccounts ?? []);
    this.loading.set(false);
  }

  async connectBank(setupToken: string): Promise<void> {
    this.connecting.set(true);
    this.connectError.set(null);
    try {
      await this.linkService.claim(setupToken);
      await this.syncService.syncNow();
      await this.refresh();
    } catch (error) {
      this.connectError.set(error instanceof Error ? error.message : 'Could not connect that bank.');
    } finally {
      this.connecting.set(false);
    }
  }

  async syncNow(): Promise<void> {
    await this.syncService.syncNow();
    await this.refresh();
  }

  async addDiscovered(discovered: DiscoveredSimplefinAccount, type: AccountType): Promise<void> {
    this.discoveredActionPending.set(true);
    try {
      await this.syncService.addDiscoveredAccount(discovered, type);
      await this.refresh();
    } finally {
      this.discoveredActionPending.set(false);
    }
  }

  async ignoreDiscovered(discovered: DiscoveredSimplefinAccount): Promise<void> {
    this.discoveredActionPending.set(true);
    try {
      await this.syncService.ignoreDiscoveredAccount(discovered);
      await this.refresh();
    } finally {
      this.discoveredActionPending.set(false);
    }
  }

  async renameAccount(accountId: string, name: string): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const doc = await db.accounts.findOne(accountId).exec();
    await doc?.incrementalPatch({ name });
    await this.refresh();
  }

  async setAccountType(accountId: string, type: AccountType): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const doc = await db.accounts.findOne(accountId).exec();
    await doc?.incrementalPatch({ type });
    await this.refresh();
  }

  async unignore(key: string): Promise<void> {
    await this.syncService.unignoreDiscoveredAccount(key);
    await this.refresh();
  }

  /** Creates a Manual Account (ADR-0016): a synthetic Institution row for the named bank,
   * plus an Account with no live SimpleFIN identity — `connId`/`externalAccountId` are
   * placeholders unique to this account, never real SimpleFIN ids, so the sync loop's
   * matching logic can never accidentally claim them. Starts at a zero balance; both the
   * balance and its transactions are populated later by a Statement Import. */
  async createManualAccount(bankName: string, accountName: string, type: AccountType): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const institutionId = crypto.randomUUID();
    await db.institutions.insert({ id: institutionId, name: bankName, url: null });

    const accountId = crypto.randomUUID();
    await db.accounts.insert({
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
      needsReconnect: false,
      syncIssue: null,
      missing: false,
      isManual: true,
    });

    await this.refresh();
  }

  /** Imports a Statement Import file (issue #39) into a Manual Account: parses fileText via
   * StatementImportService (upserting transactions by FITID and updating balance/balanceDate
   * from the file's ledger balance), then re-reads so the account card reflects the result.
   * The result/error banner is keyed by lastImportAccountId rather than cleared here, so it
   * survives the importingAccountId reset below and stays attached to the right card. */
  async importStatement(accountId: string, fileText: string): Promise<void> {
    this.importingAccountId.set(accountId);
    this.lastImportAccountId.set(accountId);
    this.importError.set(null);
    this.importResultMessage.set(null);
    try {
      const result = await this.statementImportService.importStatement(accountId, fileText);
      const parts = [`Imported ${result.importedCount} new transaction${result.importedCount === 1 ? '' : 's'}`];
      if (result.updatedCount > 0) {
        parts.push(`updated ${result.updatedCount}`);
      }
      this.importResultMessage.set(`${parts.join(', ')}.`);
      await this.refresh();
    } catch (error) {
      this.importError.set(error instanceof Error ? error.message : 'Could not import that statement file.');
    } finally {
      this.importingAccountId.set(null);
    }
  }

  /** Deletes an Account and its Transactions/CategorizationRules (ADR-0017), via
   * AccountDeletionService — see that service for the connection-cleanup policy. */
  async deleteAccount(accountId: string): Promise<void> {
    this.deletingAccountId.set(accountId);
    this.deleteError.set(null);
    try {
      await this.accountDeletionService.deleteAccount(accountId);
      await this.refresh();
    } catch (error) {
      this.deleteError.set(error instanceof Error ? error.message : 'Could not delete that account.');
    } finally {
      this.deletingAccountId.set(null);
    }
  }
}
