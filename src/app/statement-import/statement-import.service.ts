import { Injectable, inject } from '@angular/core';
import type { Transaction } from '../data/models';
import { DatabaseService, type SpearmintDatabase } from '../data/database.service';
import { TransactionIngestionService } from '../transactions/transaction-ingestion.service';
import { StatementImportError, parseOfxStatement, type OfxTransaction } from './ofx-parser.util';

export interface StatementImportResult {
  importedCount: number;
  updatedCount: number;
}

/** Matches transactionSchema's `id` field in data/schemas.ts — kept as a local constant
 * rather than importing the schema, since only the length constraint is needed here. */
const TRANSACTION_ID_MAX_LENGTH = 100;

/** Namespaced by accountId — an OFX FITID is only guaranteed unique within one bank's
 * statement, not globally, but Transaction.id is a single global primary key. Throws rather
 * than silently truncating, so an unusually long FITID fails the whole import loudly instead
 * of colliding with another transaction under a shortened id. */
function transactionId(accountId: string, fitid: string): string {
  const id = `${accountId}:${fitid}`;
  if (id.length > TRANSACTION_ID_MAX_LENGTH) {
    throw new StatementImportError(`This file has a transaction id too long to import: "${fitid}".`);
  }
  return id;
}

/**
 * Imports a Statement Import (OFX/QFX/QBO) file into a Manual Account (issue #39,
 * ADR-0016). Parses the whole file before writing anything, so a malformed file fails
 * loudly instead of leaving a partial import; upserts by FITID so re-importing an
 * overlapping statement period never duplicates rows; and reuses
 * TransactionIngestionService for new rows, exactly as SimpleFIN sync does, so the same
 * CategorizationRules auto-categorize them.
 */
@Injectable({ providedIn: 'root' })
export class StatementImportService {
  private readonly databaseService = inject(DatabaseService);
  private readonly transactionIngestion = inject(TransactionIngestionService);

  async importStatement(accountId: string, fileText: string): Promise<StatementImportResult> {
    const db = await this.databaseService.getDatabase();
    const account = await db.accounts.findOne(accountId).exec();
    if (!account) {
      throw new StatementImportError('That account no longer exists.');
    }
    if (!account.isManual) {
      throw new StatementImportError('Statement import is only available for a Manual Account.');
    }

    const statement = parseOfxStatement(fileText);

    const updatedCount = await this.upsertTransactions(db, accountId, statement.transactions);

    await account.incrementalPatch({
      balance: statement.ledgerBalance.amount,
      balanceDate: statement.ledgerBalance.dateAsOf,
    });

    return { importedCount: statement.transactions.length - updatedCount, updatedCount };
  }

  /** Never re-categorizes an already-known FITID — only mutable fields are patched, matching
   * SimplefinSyncService.upsertPostedTransactions. New ids run through the shared
   * classify-then-upsert path once. Returns how many were updates rather than new inserts. */
  private async upsertTransactions(
    db: SpearmintDatabase,
    accountId: string,
    transactions: OfxTransaction[]
  ): Promise<number> {
    // Every id computed (and validated) up front, before any DB write — an oversized FITID
    // fails the whole import here rather than leaving an earlier transaction in this same
    // file already written.
    const withIds = transactions.map((t) => ({ t, id: transactionId(accountId, t.fitid) }));

    let updatedCount = 0;
    const newDrafts: Transaction[] = [];
    for (const { t, id } of withIds) {
      const existing = await db.transactions.findOne(id).exec();
      if (existing) {
        await existing.incrementalPatch({
          date: t.datePosted,
          description: t.name,
          amount: t.amount,
        });
        updatedCount++;
      } else {
        newDrafts.push({
          id,
          accountId,
          date: t.datePosted,
          description: t.name,
          amount: t.amount,
          pending: false,
          categoryId: null,
          excludeFromBudget: false,
          notes: null,
        });
      }
    }
    await this.transactionIngestion.categorizeAndInsert(accountId, newDrafts);
    return updatedCount;
  }
}
