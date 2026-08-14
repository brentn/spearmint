import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  currentYearMonth,
  elapsedMonthFraction,
  formatYearMonth,
  nextYearMonth,
  previousYearMonth,
} from './period.util';

describe('previousYearMonth / nextYearMonth', () => {
  it('steps back a month within the same year', () => {
    expect(previousYearMonth('2026-08')).toBe('2026-07');
  });

  it('steps back across a year boundary', () => {
    expect(previousYearMonth('2026-01')).toBe('2025-12');
  });

  it('steps forward a month within the same year', () => {
    expect(nextYearMonth('2026-08')).toBe('2026-09');
  });

  it('steps forward across a year boundary', () => {
    expect(nextYearMonth('2026-12')).toBe('2027-01');
  });
});

describe('currentYearMonth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('derives YYYY-MM from the current UTC date', () => {
    vi.setSystemTime(new Date('2026-08-14T23:00:00Z'));
    expect(currentYearMonth()).toBe('2026-08');
  });
});

describe('formatYearMonth', () => {
  it('formats as a full month name and year', () => {
    expect(formatYearMonth('2026-08')).toBe('August 2026');
  });
});

describe('elapsedMonthFraction', () => {
  it('is 0 for a period that is not the current month', () => {
    expect(elapsedMonthFraction('2026-07', new Date('2026-08-14T00:00:00Z'))).toBe(0);
  });

  it('is the elapsed fraction of the current UTC month', () => {
    // Aug 2026 has 31 days; the 14th is 14/31 through the month.
    expect(elapsedMonthFraction('2026-08', new Date('2026-08-14T00:00:00Z'))).toBeCloseTo(14 / 31, 5);
  });

  it('clamps to 1 on the last day of the month', () => {
    expect(elapsedMonthFraction('2026-08', new Date('2026-08-31T00:00:00Z'))).toBeCloseTo(1, 5);
  });
});
