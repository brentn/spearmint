import { Injectable, signal } from '@angular/core';

/**
 * Holds the dismissible one-tap suggestion tier (spec §3.1) as session-scoped in-memory state,
 * not persisted to RxDB — the domain model's Transaction shape is locked and has no field for
 * it. This map alone does not survive a reload; TransactionsStore.refreshSuggestions()
 * recomputes an entry for any uncategorized transaction that doesn't already have one, so a
 * suggestion offered before a reload isn't permanently lost.
 */
@Injectable({ providedIn: 'root' })
export class CategorizationSuggestionsService {
  private readonly suggestions = signal<ReadonlyMap<string, string>>(new Map());

  readonly all = this.suggestions.asReadonly();

  get(transactionId: string): string | null {
    return this.suggestions().get(transactionId) ?? null;
  }

  set(transactionId: string, categoryId: string): void {
    this.suggestions.update((current) => {
      const next = new Map(current);
      next.set(transactionId, categoryId);
      return next;
    });
  }

  dismiss(transactionId: string): void {
    if (!this.suggestions().has(transactionId)) {
      return;
    }
    this.suggestions.update((current) => {
      const next = new Map(current);
      next.delete(transactionId);
      return next;
    });
  }
}
