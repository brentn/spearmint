import { describe, expect, it } from 'vitest';
import type { CategorizationRule } from '../data/models';
import { classifyTransaction, dayOfMonthFromDateOnly, type CategorizationCandidate } from './categorization-scoring.util';

function buildRule(overrides: Partial<CategorizationRule> = {}): CategorizationRule {
  return {
    id: 'rule-1',
    accountId: 'acc-1',
    normalizedDescription: 'STARBUCKS',
    amount: -5,
    dayOfMonth: 10,
    categoryId: 'cat-coffee',
    createdAtUtc: '2026-01-01T00:00:00.000Z',
    updatedAtUtc: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildCandidate(overrides: Partial<CategorizationCandidate> = {}): CategorizationCandidate {
  return {
    accountId: 'acc-1',
    description: 'Starbucks',
    amount: -5,
    date: '2026-08-10',
    ...overrides,
  };
}

describe('dayOfMonthFromDateOnly', () => {
  it('extracts the calendar day from a YYYY-MM-DD string', () => {
    expect(dayOfMonthFromDateOnly('2026-08-31')).toBe(31);
    expect(dayOfMonthFromDateOnly('2026-01-05')).toBe(5);
  });
});

describe('classifyTransaction', () => {
  it('auto-applies for a near-perfect match with no competing candidate', () => {
    const outcome = classifyTransaction(buildCandidate(), [buildRule()]);
    expect(outcome).toEqual({ tier: 'auto', categoryId: 'cat-coffee', ruleId: 'rule-1' });
  });

  it('gates candidacy on accountId: a matching rule on a different account never matches', () => {
    const outcome = classifyTransaction(buildCandidate({ accountId: 'acc-2' }), [buildRule({ accountId: 'acc-1' })]);
    expect(outcome).toEqual({ tier: 'none', categoryId: null, ruleId: null });
  });

  it('returns no match when there are no rules', () => {
    expect(classifyTransaction(buildCandidate(), [])).toEqual({ tier: 'none', categoryId: null, ruleId: null });
  });

  it('surfaces a mid-confidence match as a dismissible suggestion, not an auto-apply', () => {
    const rule = buildRule({ normalizedDescription: 'TARGET STORE DOWNTOWN', amount: -40, dayOfMonth: 12 });
    const candidate = buildCandidate({ description: 'Target Store Uptown Extra', amount: -40, date: '2026-08-12' });

    const outcome = classifyTransaction(candidate, [rule]);

    expect(outcome.tier).toBe('suggest');
    expect(outcome.categoryId).toBe(rule.categoryId);
  });

  it('leaves an unrelated transaction unmatched (score below the suggestion floor)', () => {
    const rule = buildRule();
    const candidate = buildCandidate({ description: 'Giant Supermarket Purchase', amount: -500, date: '2026-08-25' });

    expect(classifyTransaction(candidate, [rule])).toEqual({ tier: 'none', categoryId: null, ruleId: null });
  });

  it('downgrades to a suggestion when the top two candidates are within the auto-apply margin', () => {
    const ruleA = buildRule({ id: 'rule-a', categoryId: 'cat-a' });
    const ruleB = buildRule({ id: 'rule-b', categoryId: 'cat-b' });

    const outcome = classifyTransaction(buildCandidate(), [ruleA, ruleB]);

    expect(outcome.tier).toBe('suggest');
  });

  it('picks the single highest-scoring candidate rather than merging multiple matches', () => {
    const weakRule = buildRule({ id: 'rule-weak', categoryId: 'cat-weak', normalizedDescription: 'STARBUCKS DOWNTOWN' });
    const strongRule = buildRule({ id: 'rule-strong', categoryId: 'cat-strong', normalizedDescription: 'STARBUCKS' });

    const outcome = classifyTransaction(buildCandidate({ description: 'Starbucks' }), [weakRule, strongRule]);

    expect(outcome.categoryId).toBe('cat-strong');
  });
});
