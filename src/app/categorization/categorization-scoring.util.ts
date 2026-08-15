import type { CategorizationRule, DateOnly } from '../data/models';
import { normalizeDescription } from './description-normalization.util';
import { tokenSetJaccard } from './token-similarity.util';

// Tunable defaults, not final (spec §3.1) — the domain-modeling ticket flagged these as a
// starting point, not a locked constant.
export const NAME_WEIGHT = 0.5;
export const AMOUNT_WEIGHT = 0.25;
// Not multiplied by a computed score: same-account candidacy is already a hard gate (rules for
// other accounts are filtered out before scoring), so this is a flat credit for a check every
// scored candidate has already passed, not a variable signal like the other three.
export const ACCOUNT_MATCH_CREDIT = 0.15;
export const DAY_OF_MONTH_WEIGHT = 0.1;

export const AUTO_APPLY_SCORE_THRESHOLD = 0.85;
export const AUTO_APPLY_MARGIN_THRESHOLD = 0.1;
export const SUGGEST_SCORE_THRESHOLD = 0.6;

export interface CategorizationCandidate {
  accountId: string;
  description: string;
  amount: number;
  date: DateOnly;
}

export type CategorizationTier = 'auto' | 'suggest' | 'none';

export interface CategorizationOutcome {
  tier: CategorizationTier;
  categoryId: string | null;
  ruleId: string | null;
}

const NO_MATCH: CategorizationOutcome = { tier: 'none', categoryId: null, ruleId: null };

export function dayOfMonthFromDateOnly(date: DateOnly): number {
  return Number(date.slice(8, 10));
}

/** Amount proximity: full credit within 5%, decaying linearly to 0 as the relative gap grows. */
function amountProximityScore(amount: number, ruleAmount: number): number {
  const denominator = Math.max(Math.abs(amount), Math.abs(ruleAmount), 1);
  const relativeDiff = Math.abs(amount - ruleAmount) / denominator;
  if (relativeDiff <= 0.05) {
    return 1;
  }
  return Math.max(0, 1 - relativeDiff);
}

/** Day-of-month recurrence proximity, circular across month-end wraparound (e.g. 31st vs 1st). */
function dayOfMonthProximityScore(day: number, ruleDay: number): number {
  const rawDiff = Math.abs(day - ruleDay);
  const diff = Math.min(rawDiff, 31 - rawDiff);
  if (diff <= 3) {
    return 1;
  }
  return Math.max(0, 1 - (diff - 3) / 12);
}

function scoreRule(normalizedDescription: string, dayOfMonth: number, candidate: CategorizationCandidate, rule: CategorizationRule): number {
  const nameScore = tokenSetJaccard(normalizedDescription, rule.normalizedDescription);
  const amountScore = amountProximityScore(candidate.amount, rule.amount);
  const dayScore = dayOfMonthProximityScore(dayOfMonth, rule.dayOfMonth);
  return NAME_WEIGHT * nameScore + AMOUNT_WEIGHT * amountScore + ACCOUNT_MATCH_CREDIT + DAY_OF_MONTH_WEIGHT * dayScore;
}

/**
 * Scores an incoming transaction against every stored CategorizationRule and resolves the
 * three-tier outcome (spec §3.1): same-account is a hard candidacy gate; among the surviving
 * candidates the single highest scorer is taken (never merged/averaged) and compared against
 * its runner-up for the auto-apply margin check.
 */
export function classifyTransaction(candidate: CategorizationCandidate, rules: CategorizationRule[]): CategorizationOutcome {
  const sameAccountRules = rules.filter((rule) => rule.accountId === candidate.accountId);
  if (sameAccountRules.length === 0) {
    return NO_MATCH;
  }

  const normalizedDescription = normalizeDescription(candidate.description);
  const dayOfMonth = dayOfMonthFromDateOnly(candidate.date);

  const scored = sameAccountRules
    .map((rule) => ({ rule, score: scoreRule(normalizedDescription, dayOfMonth, candidate, rule) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const runnerUpScore = scored[1]?.score ?? 0;
  const margin = best.score - runnerUpScore;

  if (best.score >= AUTO_APPLY_SCORE_THRESHOLD && margin >= AUTO_APPLY_MARGIN_THRESHOLD) {
    return { tier: 'auto', categoryId: best.rule.categoryId, ruleId: best.rule.id };
  }
  if (best.score >= SUGGEST_SCORE_THRESHOLD) {
    return { tier: 'suggest', categoryId: best.rule.categoryId, ruleId: best.rule.id };
  }
  return NO_MATCH;
}
