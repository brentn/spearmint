import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';
import { AuthGate } from './auth/auth-gate/auth-gate';
import { IdleLockService } from './auth/idle-lock.service';
import { NavShell } from './shell/nav-shell/nav-shell';
import { NavScrollContainerDirective } from './shell/nav-scroll-container.directive';
import { NavScrollService } from './shell/nav-scroll.service';
import { Toast } from './shell/toast/toast';
import { ToastService } from './shell/toast/toast.service';
import { SimplefinSyncService } from './simplefin/simplefin-sync.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AuthGate, NavShell, NavScrollContainerDirective, Toast],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly authService = inject(AuthService);
  protected readonly navScrollService = inject(NavScrollService);
  private readonly syncService = inject(SimplefinSyncService);
  private readonly idleLockService = inject(IdleLockService);
  private readonly toastService = inject(ToastService);

  constructor() {
    // "First app-open of each calendar day" — runAutoSyncIfDue is itself gated by
    // lastSyncDate, so re-running this on every unlock within the same day is a no-op.
    effect(() => {
      if (this.authService.isUnlocked()) {
        this.idleLockService.start();
        void this.syncService.runAutoSyncIfDue();
      } else {
        this.idleLockService.stop();
      }
    });

    // Fires for both auto- and manual sync (both funnel through SimplefinSyncService),
    // silent when a run finds nothing new (ADR 0007 — ambient signal, not a heartbeat).
    effect(() => {
      const { count } = this.syncService.lastSyncChange();
      if (count > 0) {
        this.toastService.show(`${count} transaction${count === 1 ? '' : 's'} updated`);
      }
    });
  }
}
