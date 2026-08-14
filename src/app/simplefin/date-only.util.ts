import type { DateOnly } from '../data/models';

/** Pure UTC-calendar-date arithmetic — this repo already paid for a local-timezone bug once. */

function toUtcMidnight(date: DateOnly): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDaysUtc(date: DateOnly, days: number): DateOnly {
  const d = toUtcMidnight(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetweenUtc(a: DateOnly, b: DateOnly): number {
  return Math.round((toUtcMidnight(b).getTime() - toUtcMidnight(a).getTime()) / 86_400_000);
}

export function dateOnlyToEpochSeconds(date: DateOnly): number {
  return toUtcMidnight(date).getTime() / 1000;
}

export function todayDateOnlyUtc(): DateOnly {
  return new Date().toISOString().slice(0, 10);
}
