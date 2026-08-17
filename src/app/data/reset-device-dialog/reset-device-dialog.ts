import { Component, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { DatabaseService } from '../database.service';

/**
 * Shared confirm-and-wipe dialog for the two places that offer a full local-data reset:
 * Settings' Danger Zone and the lock screen's "Trouble unlocking?" escape hatch (issue #35)
 * — same destructive action, same confirmation pattern, different surrounding copy/trigger.
 * The caller owns the trigger button (styling differs between the two contexts) and calls
 * `open()` on this component via a template reference variable.
 */
@Component({
  selector: 'app-reset-device-dialog',
  templateUrl: './reset-device-dialog.html',
  styleUrl: './reset-device-dialog.scss',
})
export class ResetDeviceDialog {
  private readonly databaseService = inject(DatabaseService);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  readonly title = input.required<string>();
  readonly body = input.required<string>();

  readonly resetting = signal(false);
  readonly error = signal<string | null>(null);

  open(): void {
    this.error.set(null);
    this.dialog()?.nativeElement.showModal();
  }

  close(): void {
    this.dialog()?.nativeElement.close();
  }

  /** DatabaseService.resetDatabase() only closes and wipes storage — it doesn't reset
   * in-memory app state (signals, unlock state, etc.) — so a reload is the simplest way
   * to land back on a clean fresh-install screen afterward. */
  async confirm(): Promise<void> {
    this.resetting.set(true);
    this.error.set(null);
    try {
      await this.databaseService.resetDatabase();
      window.location.reload();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not reset local data.');
      this.resetting.set(false);
    }
  }
}
