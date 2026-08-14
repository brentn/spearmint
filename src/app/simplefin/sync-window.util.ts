import type { DateOnly } from '../data/models';
import { addDaysUtc, daysBetweenUtc } from './date-only.util';

export interface SyncWindow {
  start: DateOnly;
  end: DateOnly;
}

const OVERLAP_DAYS = 7;
const SINGLE_REQUEST_CAP_DAYS = 90;
const CHUNK_DAYS = 45;
const MAX_CHUNKS = 5;

/**
 * Fetch window per spec §3: [lastSyncDate - 7d, today], with a 7-day overlap to catch
 * late-posting transactions (harmless — posted-transaction ingest is idempotent by id).
 * A null lastSyncDate (first-ever sync) is treated as the maximum backfill target, so
 * the same 5-chunk cap below governs how far back a first sync reaches.
 *
 * When the span exceeds the 90-day-per-request cap, this walks backward from today in
 * <=45-day chunks, up to 5 requests, stopping once the walked-back range reaches the
 * target start. If 5x45=225 days still doesn't cover the full gap, the oldest slice is
 * left uncovered rather than issuing a 6th request.
 */
export function computeSyncWindows(lastSyncDate: DateOnly | null, today: DateOnly): SyncWindow[] {
  const targetStart =
    lastSyncDate !== null
      ? addDaysUtc(lastSyncDate, -OVERLAP_DAYS)
      : addDaysUtc(today, -CHUNK_DAYS * MAX_CHUNKS);

  if (daysBetweenUtc(targetStart, today) <= SINGLE_REQUEST_CAP_DAYS) {
    return [{ start: targetStart, end: today }];
  }

  const windows: SyncWindow[] = [];
  let cursorEnd = today;
  for (let i = 0; i < MAX_CHUNKS; i++) {
    const naturalStart = addDaysUtc(cursorEnd, -(CHUNK_DAYS - 1));
    if (daysBetweenUtc(naturalStart, targetStart) > 0) {
      // targetStart falls inside this chunk — clamp to it and stop.
      windows.push({ start: targetStart, end: cursorEnd });
      break;
    }
    windows.push({ start: naturalStart, end: cursorEnd });
    if (naturalStart === targetStart) {
      break;
    }
    cursorEnd = addDaysUtc(naturalStart, -1);
  }
  return windows;
}
