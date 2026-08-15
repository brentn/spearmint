import { describe, expect, it } from 'vitest';
import { normalizeDescription } from './description-normalization.util';

describe('normalizeDescription', () => {
  it('case-folds to uppercase', () => {
    expect(normalizeDescription('Coffee Shop')).toBe('COFFEE SHOP');
  });

  it('strips everything from a noise-label prefix onward', () => {
    expect(normalizeDescription('CHECK DEPOSIT Cheque Date 08/12/2026')).toBe('CHECK DEPOSIT');
    expect(normalizeDescription('WIRE TRANSFER Confirmation # 88213')).toBe('WIRE TRANSFER');
    expect(normalizeDescription('ACH PAYMENT Reference Number 12345XYZ')).toBe('ACH PAYMENT');
  });

  it('strips $-amount fragments', () => {
    expect(normalizeDescription('AMAZON.COM PURCHASE $45.99')).toBe('AMAZON COM PURCHASE');
  });

  it('strips date fragments', () => {
    expect(normalizeDescription('PAYMENT 08/12/2026 THANK YOU')).toBe('PAYMENT THANK YOU');
    expect(normalizeDescription('POSTED 2026-08-12 GROCERY')).toBe('POSTED GROCERY');
  });

  it('strips long mixed-alphanumeric reference tokens but keeps short/plain-word tokens', () => {
    expect(normalizeDescription('AMZN MKTP US*2K3L4Q9')).toBe('AMZN MKTP US');
  });

  it('collapses whitespace and punctuation runs', () => {
    expect(normalizeDescription('  TARGET   T-1234    #55  ')).toBe('TARGET T 1234 55');
  });

  it('caps normalized output at 40 characters without truncating mid-token matching', () => {
    const long = 'A'.repeat(60);
    const result = normalizeDescription(long);
    expect(result.length).toBe(40);
  });

  it('is stable/idempotent when applied twice', () => {
    const once = normalizeDescription('Starbucks Store #4821 $6.25');
    expect(normalizeDescription(once)).toBe(once);
  });

  it('returns an empty string for a description that is entirely noise', () => {
    expect(normalizeDescription('$12.00')).toBe('');
  });
});
