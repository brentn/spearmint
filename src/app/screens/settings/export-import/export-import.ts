import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { MINIMUM_PASSWORD_LENGTH } from 'rxdb/plugins/encryption-crypto-js';
import { BackupService } from '../../../data/backup.service';
import { SettingsHeader } from '../settings-header/settings-header';

@Component({
  selector: 'app-export-import',
  imports: [SettingsHeader],
  templateUrl: './export-import.html',
  styleUrl: './export-import.scss',
})
export class ExportImportScreen {
  private readonly backupService = inject(BackupService);
  private readonly importDialog = viewChild<ElementRef<HTMLDialogElement>>('importDialog');

  protected readonly minPasswordLength = MINIMUM_PASSWORD_LENGTH;

  readonly encryptExport = signal(false);
  readonly exportPassword = signal('');
  readonly exportPasswordConfirm = signal('');
  readonly exporting = signal(false);
  readonly exportError = signal<string | null>(null);
  readonly exportDone = signal(false);

  readonly importFile = signal<File | null>(null);
  readonly importPassword = signal('');
  readonly importing = signal(false);
  readonly importError = signal<string | null>(null);

  constructor() {
    void this.loadEncryptionDefault();
  }

  private async loadEncryptionDefault(): Promise<void> {
    this.encryptExport.set(await this.backupService.getExportEncryptionDefault());
  }

  async exportBackup(): Promise<void> {
    this.exportError.set(null);
    this.exportDone.set(false);
    this.exporting.set(true);
    try {
      const blob = await this.backupService.exportBackup(this.encryptExport(), this.exportPassword());
      this.downloadBlob(blob, `spearmint-backup-${new Date().toISOString().slice(0, 10)}.json`);
      this.exportPassword.set('');
      this.exportPasswordConfirm.set('');
      this.exportDone.set(true);
    } catch (err) {
      this.exportError.set(err instanceof Error ? err.message : 'Could not export a backup.');
    } finally {
      this.exporting.set(false);
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.importFile.set(input.files?.[0] ?? null);
    this.importError.set(null);
  }

  openImportDialog(): void {
    if (!this.importFile()) {
      return;
    }
    this.importError.set(null);
    this.importDialog()?.nativeElement.showModal();
  }

  closeImportDialog(): void {
    this.importDialog()?.nativeElement.close();
  }

  async confirmImport(): Promise<void> {
    const file = this.importFile();
    if (!file) {
      return;
    }
    this.importing.set(true);
    this.importError.set(null);
    try {
      const fileText = await this.readFileText(file);
      await this.backupService.importBackup(fileText, this.importPassword() || null);
      // Local app state (auth unlock, in-memory signals) still assumes the
      // previous data exists — a full reload is the simplest way to land back
      // on a clean state reflecting the just-imported dataset, matching the
      // same reasoning as Settings.confirmReset.
      window.location.reload();
    } catch (err) {
      this.importError.set(err instanceof Error ? err.message : 'Could not import that backup.');
      this.importing.set(false);
    }
  }

  private readFileText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }
}
