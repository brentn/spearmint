import { describe, expect, it } from 'vitest';
import { epochSecondsToDateOnly, parseDecimalAmount } from './simplefin-mapping.util';

describe('parseDecimalAmount', () => {
  it('parses a positive decimal string', () => {
    expect(parseDecimalAmount('113705.51')).toBe(113705.51);
  });

  it('parses a negative decimal string', () => {
    expect(parseDecimalAmount('-65.50')).toBe(-65.5);
  });

  it('parses a whole-dollar string', () => {
    expect(parseDecimalAmount('20')).toBe(20);
  });

  it('rounds away binary floating-point drift to the cent', () => {
    expect(parseDecimalAmount('0.1')).toBe(0.1);
    expect(parseDecimalAmount('19.999999999998')).toBe(20);
  });

  it('throws on a non-numeric string', () => {
    expect(() => parseDecimalAmount('not-a-number')).toThrow();
  });
});

describe('epochSecondsToDateOnly', () => {
  it('converts epoch seconds to a UTC calendar date', () => {
    // 2026-08-13T08:00:00Z
    expect(epochSecondsToDateOnly(1786608000)).toBe('2026-08-13');
  });

  it('does not shift the date for a time late in the UTC day', () => {
    // 2026-08-13T23:59:00Z
    expect(epochSecondsToDateOnly(1786665540)).toBe('2026-08-13');
  });
});
