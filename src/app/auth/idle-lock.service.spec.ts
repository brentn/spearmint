import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { IdleLockService } from './idle-lock.service';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

describe('IdleLockService', () => {
  let lock: ReturnType<typeof vi.fn>;
  let service: IdleLockService;
  let visibilityState: DocumentVisibilityState;

  beforeEach(() => {
    lock = vi.fn();
    visibilityState = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState);
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      providers: [IdleLockService, { provide: AuthService, useValue: { lock } }],
    });
    service = TestBed.inject(IdleLockService);
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function fireVisibilityChange(): void {
    document.dispatchEvent(new Event('visibilitychange'));
  }

  it('locks after the idle threshold elapses with no activity', () => {
    service.start();

    vi.advanceTimersByTime(FIVE_MINUTES_MS + 1000);

    expect(lock).toHaveBeenCalledTimes(1);
  });

  it('does not lock before the idle threshold elapses', () => {
    service.start();

    vi.advanceTimersByTime(FIVE_MINUTES_MS - 1000);

    expect(lock).not.toHaveBeenCalled();
  });

  it('resets the clock on pointer activity', () => {
    service.start();

    vi.advanceTimersByTime(FIVE_MINUTES_MS - 1000);
    window.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(FIVE_MINUTES_MS - 1000);

    expect(lock).not.toHaveBeenCalled();
  });

  it('resets the clock on keyboard activity', () => {
    service.start();

    vi.advanceTimersByTime(FIVE_MINUTES_MS - 1000);
    window.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(FIVE_MINUTES_MS - 1000);

    expect(lock).not.toHaveBeenCalled();
  });

  it('locks on returning to a visible tab after the threshold was crossed while hidden', () => {
    service.start();
    visibilityState = 'hidden';

    // In a real browser, backgrounded-tab timer throttling can delay the periodic
    // check well past the threshold — the visibilitychange handler is what guarantees
    // an immediate lock on return rather than waiting on a possibly-throttled timer.
    vi.advanceTimersByTime(FIVE_MINUTES_MS + 1000);
    visibilityState = 'visible';
    fireVisibilityChange();

    expect(lock).toHaveBeenCalled();
  });

  it('does not lock on returning to a visible tab before the threshold elapses while hidden', () => {
    service.start();
    visibilityState = 'hidden';

    vi.advanceTimersByTime(FIVE_MINUTES_MS - 1000);
    visibilityState = 'visible';
    fireVisibilityChange();

    expect(lock).not.toHaveBeenCalled();
  });

  it('does nothing once stopped', () => {
    service.start();
    service.stop();

    vi.advanceTimersByTime(FIVE_MINUTES_MS + 1000);

    expect(lock).not.toHaveBeenCalled();
  });
});
