import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../data/database.service';
import {
  classifyTransaction,
  dayOfMonthFromDateOnly,
  type CategorizationCandidate,
  type CategorizationOutcome,
} from './categorization-scoring.util';
import { normalizeDescription } from './description-normalization.util';

export interface CategorizationSubject extends CategorizationCandidate {
  id: string;
}

/**
 * RxDB-backed half of auto-categorization (spec §3.1): scores incoming transactions against
 * stored CategorizationRules, and records/updates a rule whenever a user corrects a category.
 * The scoring itself is pure (categorization-scoring.util.ts) — this service is just the
 * fetch/upsert plumbing around it.
 */
@Injectable({ providedIn: 'root' })
export class CategorizationRulesService {
  private readonly databaseService = inject(DatabaseService);

  /** Classifies every candidate for one account against that account's stored rules, fetched once. */
  async classifyMany(accountId: string, candidates: CategorizationSubject[]): Promise<Map<string, CategorizationOutcome>> {
    const outcomes = new Map<string, CategorizationOutcome>();
    if (candidates.length === 0) {
      return outcomes;
    }

    const db = await this.databaseService.getDatabase();
    const ruleDocs = await db.categorizationRules.find({ selector: { accountId } }).exec();
    const rules = ruleDocs.map((doc) => doc.toJSON());

    for (const candidate of candidates) {
      outcomes.set(candidate.id, classifyTransaction(candidate, rules));
    }
    return outcomes;
  }

  /**
   * Upserts a CategorizationRule from a manual correction, deduped by (accountId,
   * normalizedDescription) — the dedup key left open by the spec ("left to the implementation
   * effort"). A repeated correction on the same merchant fingerprint updates the existing rule
   * (refreshing amount/dayOfMonth/categoryId/updatedAtUtc) instead of accumulating duplicates.
   */
  async recordCorrection(transaction: CategorizationSubject, categoryId: string): Promise<void> {
    const db = await this.databaseService.getDatabase();
    const normalizedDescription = normalizeDescription(transaction.description);
    const existing = await db.categorizationRules
      .findOne({ selector: { accountId: transaction.accountId, normalizedDescription } })
      .exec();

    const nowUtc = new Date().toISOString();
    const patch = {
      amount: transaction.amount,
      dayOfMonth: dayOfMonthFromDateOnly(transaction.date),
      categoryId,
      updatedAtUtc: nowUtc,
    };

    if (existing) {
      await existing.incrementalPatch(patch);
      return;
    }

    await db.categorizationRules.insert({
      id: crypto.randomUUID(),
      accountId: transaction.accountId,
      normalizedDescription,
      createdAtUtc: nowUtc,
      ...patch,
    });
  }
}
