import { describe, expect, it } from 'vitest';
import { computeSyncWindows } from './sync-window.util';

describe('computeSyncWindows', () => {
  it('returns a single window covering [lastSyncDate - 7d, today] when within the 90-day cap', () => {
    expect(computeSyncWindows('2026-08-10', '2026-08-13')).toEqual([
      { start: '2026-08-03', end: '2026-08-13' },
    ]);
  });

  it('treats a null lastSyncDate as the maximum 225-day backfill target', () => {
    expect(computeSyncWindows(null, '2026-08-13')).toEqual([
      { start: '2026-06-30', end: '2026-08-13' },
      { start: '2026-05-16', end: '2026-06-29' },
      { start: '2026-04-01', end: '2026-05-15' },
      { start: '2026-02-15', end: '2026-03-31' },
      { start: '2026-01-01', end: '2026-02-14' },
    ]);
  });

  it('leaves the oldest slice uncovered when the gap exceeds 5x45 days, rather than issuing a 6th request', () => {
    // lastSyncDate - 7d lands on 2025-12-25, a 231-day span from today — beyond the
    // 5*45=225-day backfill cap. Windows must still stop at 5, not walk back further.
    const windows = computeSyncWindows('2026-01-01', '2026-08-13');
    expect(windows).toHaveLength(5);
    expect(windows).toEqual([
      { start: '2026-06-30', end: '2026-08-13' },
      { start: '2026-05-16', end: '2026-06-29' },
      { start: '2026-04-01', end: '2026-05-15' },
      { start: '2026-02-15', end: '2026-03-31' },
      { start: '2026-01-01', end: '2026-02-14' },
    ]);
    // The oldest 6 days (2025-12-25..2025-12-31) are left uncovered.
    expect(windows[4].start).not.toBe('2025-12-25');
  });

  it('chunks are contiguous with no gaps or overlaps', () => {
    const windows = computeSyncWindows(null, '2026-08-13');
    for (let i = 0; i < windows.length - 1; i++) {
      const nextEnd = windows[i + 1].end;
      const dayAfterNextEnd = new Date(`${nextEnd}T00:00:00Z`);
      dayAfterNextEnd.setUTCDate(dayAfterNextEnd.getUTCDate() + 1);
      expect(windows[i].start).toBe(dayAfterNextEnd.toISOString().slice(0, 10));
    }
  });

  it('uses a single, unchunked window at exactly the 90-day cap', () => {
    expect(computeSyncWindows('2026-05-22', '2026-08-13')).toEqual([
      { start: '2026-05-15', end: '2026-08-13' },
    ]);
  });

  it('switches to 45-day chunking just past the 90-day cap', () => {
    const windows = computeSyncWindows('2026-05-21', '2026-08-13');
    expect(windows[0]).toEqual({ start: '2026-06-30', end: '2026-08-13' });
    expect(windows.every((w) => w.start <= w.end)).toBe(true);
  });

  it('returns a single same-day window when lastSyncDate is today', () => {
    expect(computeSyncWindows('2026-08-13', '2026-08-13')).toEqual([
      { start: '2026-08-06', end: '2026-08-13' },
    ]);
  });
});
