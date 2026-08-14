import { describe, expect, it } from 'vitest';
import { addDaysUtc, dateOnlyToEpochSeconds, daysBetweenUtc, todayDateOnlyUtc } from './date-only.util';

describe('date-only.util', () => {
  describe('addDaysUtc', () => {
    it('adds positive days within a month', () => {
      expect(addDaysUtc('2026-08-01', 5)).toBe('2026-08-06');
    });

    it('subtracts days across a month boundary', () => {
      expect(addDaysUtc('2026-08-01', -1)).toBe('2026-07-31');
    });

    it('crosses a year boundary', () => {
      expect(addDaysUtc('2026-01-01', -1)).toBe('2025-12-31');
    });

    it('is unaffected by DST-style local-timezone shifts (pure UTC arithmetic)', () => {
      expect(addDaysUtc('2026-03-08', 1)).toBe('2026-03-09');
    });
  });

  describe('daysBetweenUtc', () => {
    it('returns 0 for the same date', () => {
      expect(daysBetweenUtc('2026-08-01', '2026-08-01')).toBe(0);
    });

    it('returns a positive count when b is after a', () => {
      expect(daysBetweenUtc('2026-08-01', '2026-08-10')).toBe(9);
    });

    it('returns a negative count when b is before a', () => {
      expect(daysBetweenUtc('2026-08-10', '2026-08-01')).toBe(-9);
    });
  });

  describe('dateOnlyToEpochSeconds', () => {
    it('returns UTC midnight for the given date', () => {
      expect(dateOnlyToEpochSeconds('2026-08-01')).toBe(Date.UTC(2026, 7, 1) / 1000);
    });
  });

  describe('todayDateOnlyUtc', () => {
    it('matches the current UTC date', () => {
      const expected = new Date().toISOString().slice(0, 10);
      expect(todayDateOnlyUtc()).toBe(expected);
    });
  });
});
