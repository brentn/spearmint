import { describe, expect, it } from 'vitest';
import { tokenSetJaccard } from './token-similarity.util';

describe('tokenSetJaccard', () => {
  it('returns 1 for identical strings', () => {
    expect(tokenSetJaccard('AMAZON MKTP US', 'AMAZON MKTP US')).toBe(1);
  });

  it('returns 0 for completely disjoint token sets', () => {
    expect(tokenSetJaccard('AMAZON MKTP US', 'TARGET STORE')).toBe(0);
  });

  it('is order-independent', () => {
    expect(tokenSetJaccard('MKTP US AMAZON', 'AMAZON MKTP US')).toBe(1);
  });

  it('scores partial overlap as intersection over union', () => {
    // {AMZN,MKTP,US,2K3L4} vs {AMAZON,MKTP,US} -> intersection 2, union 5
    expect(tokenSetJaccard('AMZN MKTP US 2K3L4', 'AMAZON MKTP US')).toBeCloseTo(2 / 5);
  });

  it('returns 0 when either input is empty', () => {
    expect(tokenSetJaccard('', 'AMAZON')).toBe(0);
    expect(tokenSetJaccard('AMAZON', '')).toBe(0);
    expect(tokenSetJaccard('', '')).toBe(0);
  });

  it('deduplicates repeated tokens within a string', () => {
    expect(tokenSetJaccard('COFFEE COFFEE SHOP', 'COFFEE SHOP')).toBe(1);
  });
});
