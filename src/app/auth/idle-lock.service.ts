import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

// Single in-code threshold (issue #25: "something like 5 minutes"), not user-configurable.
const IDLE_LOCK_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 10 * 1000;

/**
 * Locks the app after IDLE_LOCK_MS of continuous inactivity, on one clock that covers
 * both foreground idle time and time spent backgrounded/hidden (PCI/NIST-style
 * continuous-inactivity session timeout, not an instant lock on backgrounding).
 *
 * lastActivityAt only advances on pointerdown/keydown, which the browser only
 * delivers while the tab is visible — so time spent hidden already counts toward
 * the same clock without any separate bookkeeping. The visibilitychange listener
 * exists only to react *immediately* on return (rather than waiting up to
 * CHECK_INTERVAL_MS for the next poll) when the threshold was already crossed
 * while hidden.
 */
@Injectable({ providedIn: 'root' })
export class IdleLockService {
  private readonly authService = inject(AuthService);

  private lastActivityAt = Date.now();
  private intervalId: ReturnType<typeof setInterval> | null = null;

  private readonly onActivity = (): void => {
    this.lastActivityAt = Date.now();
  };

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.checkLock();
    }
  };

  start(): void {
    if (this.intervalId !== null) {
      return;
    }
    this.lastActivityAt = Date.now();
    window.addEventListener('pointerdown', this.onActivity);
    window.addEventListener('keydown', this.onActivity);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.intervalId = setInterval(() => this.checkLock(), CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId === null) {
      return;
    }
    clearInterval(this.intervalId);
    this.intervalId = null;
    window.removeEventListener('pointerdown', this.onActivity);
    window.removeEventListener('keydown', this.onActivity);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private checkLock(): void {
    if (Date.now() - this.lastActivityAt >= IDLE_LOCK_MS) {
      this.authService.lock();
    }
  }
}
