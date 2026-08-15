import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatabaseService } from '../../data/database.service';
import { SettingsHeader } from './settings-header/settings-header';

@Component({
  selector: 'app-settings',
  imports: [RouterLink, SettingsHeader],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private readonly databaseService = inject(DatabaseService);
  private readonly resetDialog = viewChild<ElementRef<HTMLDialogElement>>('resetDialog');

  readonly resetting = signal(false);
  readonly error = signal<string | null>(null);

  openResetDialog(): void {
    this.error.set(null);
    this.resetDialog()?.nativeElement.showModal();
  }

  closeResetDialog(): void {
    this.resetDialog()?.nativeElement.close();
  }

  async confirmReset(): Promise<void> {
    this.resetting.set(true);
    this.error.set(null);
    try {
      await this.databaseService.resetDatabase();
      // Local app state (auth unlock, in-memory signals) still assumes the
      // deleted data exists — a full reload is the simplest way to land back
      // on a clean "Set up Spearmint" screen instead of patching every
      // consumer to notice the reset.
      window.location.reload();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not reset local data.');
      this.resetting.set(false);
    }
  }
}
