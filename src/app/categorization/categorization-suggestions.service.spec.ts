import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CategorizationSuggestionsService } from './categorization-suggestions.service';

describe('CategorizationSuggestionsService', () => {
  function build(): CategorizationSuggestionsService {
    return TestBed.configureTestingModule({}).inject(CategorizationSuggestionsService);
  }

  it('returns null for a transaction with no suggestion', () => {
    const service = build();
    expect(service.get('txn-1')).toBeNull();
  });

  it('records and retrieves a suggestion', () => {
    const service = build();
    service.set('txn-1', 'cat-coffee');
    expect(service.get('txn-1')).toBe('cat-coffee');
    expect(service.all().get('txn-1')).toBe('cat-coffee');
  });

  it('dismiss removes a suggestion', () => {
    const service = build();
    service.set('txn-1', 'cat-coffee');

    service.dismiss('txn-1');

    expect(service.get('txn-1')).toBeNull();
  });

  it('dismissing a transaction with no suggestion is a no-op', () => {
    const service = build();
    expect(() => service.dismiss('txn-missing')).not.toThrow();
    expect(service.all().size).toBe(0);
  });

  it('set overwrites an existing suggestion for the same transaction', () => {
    const service = build();
    service.set('txn-1', 'cat-a');
    service.set('txn-1', 'cat-b');
    expect(service.get('txn-1')).toBe('cat-b');
  });
});
