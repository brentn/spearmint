import type { YearMonth } from '../data/models';

/** Pure UTC-calendar YearMonth arithmetic, mirroring simplefin/date-only.util.ts's UTC discipline. */

export function isYearMonth(value: string): value is YearMonth {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return false;
  }
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

export function assertYearMonth(value: string): asserts value is YearMonth {
  if (!isYearMonth(value)) {
    throw new Error(`Invalid YearMonth value "${value}". Expected YYYY-MM.`);
  }
}

export function currentYearMonth(): YearMonth {
  return new Date().toISOString().slice(0, 7);
}

export function shiftYearMonth(period: YearMonth, monthDelta: number): YearMonth {
  assertYearMonth(period);
  const year = Number(period.slice(0, 4));
  const monthIndex = Number(period.slice(5, 7)) - 1;
  const shifted = new Date(Date.UTC(year, monthIndex + monthDelta, 1));
  return shifted.toISOString().slice(0, 7);
}

export function previousYearMonth(period: YearMonth): YearMonth {
  return shiftYearMonth(period, -1);
}

export function nextYearMonth(period: YearMonth): YearMonth {
  return shiftYearMonth(period, 1);
}

export function formatYearMonth(period: YearMonth): string {
  assertYearMonth(period);
  const year = Number(period.slice(0, 4));
  const monthIndex = Number(period.slice(5, 7)) - 1;
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return formatter.format(new Date(Date.UTC(year, monthIndex, 1)));
}

/** Elapsed fraction (0-1) of `period`'s UTC calendar month as of `today`; 0 if `period` isn't today's month. */
export function elapsedMonthFraction(period: YearMonth, today: Date = new Date()): number {
  assertYearMonth(period);
  const todayIso = today.toISOString();
  if (todayIso.slice(0, 7) !== period) {
    return 0;
  }
  const year = Number(period.slice(0, 4));
  const monthIndex = Number(period.slice(5, 7)) - 1;
  const dayOfMonth = Number(todayIso.slice(8, 10));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.max(0, Math.min(1, dayOfMonth / daysInMonth));
}
