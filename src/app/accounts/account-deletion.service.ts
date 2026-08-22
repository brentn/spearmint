import { Injectable, inject } from '@angular/core';
import { addIgnoredExternalAccountIfAbsent } from '../data/app-settings.util';
import { DatabaseService } from '../data/database.service';
import { externalAccountKey } from '../simplefin/simplefin-ingest-plan.util';

/**
 * General account-deletion primitive (ADR-0017): usable on any Account, not just a
 * Manual Account. Always removes the account's Transactions and CategorizationRules
 * along with the Account row itself.
 *
 * For a real SimpleFIN-linked account, the deleted account is added to
 * `ignoredExternalAccounts` unconditionally — regardless of whether other accounts
 * remain on the same `connId` — so the next sync's discovery pass never re-surfaces it.
 * ADR-0017 describes an additional path (deleting the connection's `SimplefinLink`
 * outright when this was the last account on it), but that isn't reflected here: nothing
 * persists a mapping from `connId` back to the `SimplefinLink`/access-URL that produced
 * it, so a link can't be reliably identified for deletion. Confirmed with the user that
 * always falling back to `ignoredExternalAccounts` is the correct behavior instead.
 */
@Injectable({ providedIn: 'root' })
export class AccountDeletionService {
  private readonly databaseService = inject(DatabaseService);

  async deleteAccount(accountId: string): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const accountDoc = await db.accounts.findOne(accountId).exec();
    if (!accountDoc) {
      return;
    }
    const account = accountDoc.toJSON();

    await db.transactions.find({ selector: { accountId } }).remove();
    await db.categorizationRules.find({ selector: { accountId } }).remove();

    if (!account.isManual) {
      const institution = await db.institutions.findOne(account.institutionId).exec();
      await addIgnoredExternalAccountIfAbsent(db, {
        key: externalAccountKey(account.connId, account.externalAccountId),
        name: account.originalAccountName,
        institutionName: institution?.name ?? 'Unknown institution',
      });
    }

    await accountDoc.remove();
  }
}
