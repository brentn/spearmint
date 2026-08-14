import { Injectable, inject, signal } from '@angular/core';
import { getAppSettingsDoc } from '../../../data/app-settings.util';
import { DatabaseService } from '../../../data/database.service';
import type { Account, AccountType, IgnoredExternalAccount, Institution } from '../../../data/models';
import type { DiscoveredSimplefinAccount } from '../../../simplefin/simplefin-ingest-plan.util';
import { SimplefinLinkService } from '../../../simplefin/simplefin-link.service';
import { SimplefinSyncService } from '../../../simplefin/simplefin-sync.service';

/**
 * Screen-scoped store for Settings -> Accounts: loads accounts/institutions from RxDB
 * and re-reads them after every mutating action. Simpler than wiring RxDB's own query
 * reactivity end-to-end, and matches this codebase's existing convention (AuthService)
 * of plain signals refreshed imperatively rather than a live query subscription.
 */
@Injectable()
export class AccountsStore {
  private readonly databaseService = inject(DatabaseService);
  private readonly linkService = inject(SimplefinLinkService);
  private readonly syncService = inject(SimplefinSyncService);

  readonly loading = signal(true);
  readonly accounts = signal<Account[]>([]);
  readonly institutions = signal<Institution[]>([]);
  readonly ignoredExternalAccounts = signal<IgnoredExternalAccount[]>([]);

  readonly connecting = signal(false);
  readonly connectError = signal<string | null>(null);

  constructor() {
    void this.refresh();
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
    await this.syncService.addDiscoveredAccount(discovered, type);
    await this.refresh();
  }

  async ignoreDiscovered(discovered: DiscoveredSimplefinAccount): Promise<void> {
    await this.syncService.ignoreDiscoveredAccount(discovered);
    await this.refresh();
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
    const db = await this.databaseService.getDatabase();
    const settingsDoc = await getAppSettingsDoc(db);
    if (!settingsDoc) {
      return;
    }
    await settingsDoc.incrementalPatch({
      ignoredExternalAccounts: settingsDoc.ignoredExternalAccounts.filter((i) => i.key !== key),
    });
    await this.refresh();
  }
}
