import { Injectable, inject } from '@angular/core';
import type { RxDumpDatabaseAny } from 'rxdb';
import { decryptString, encryptString } from 'rxdb/plugins/encryption-crypto-js';
import { DEFAULT_APP_SETTINGS, getAppSettingsDoc, upsertAppSettings } from './app-settings.util';
import { DatabaseService, type SpearmintCollections } from './database.service';

const BACKUP_FORMAT = 'spearmint-backup';
const BACKUP_VERSION = 1;

interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  encrypted: boolean;
  payload: unknown;
}

type SpearmintDump = RxDumpDatabaseAny<SpearmintCollections>;

/**
 * Whole-dataset export/import — the app's only backup and only cross-device sync
 * mechanism (spec §5). Wraps RxDB's json-dump plugin (registered in
 * DatabaseService) for the actual collection dump/restore, plus an optional
 * password-based AES layer over the resulting blob: RxDB's own storage-level
 * encryption would mean re-creating the whole local database with a password,
 * which is a different feature (data-at-rest protection) than "can this
 * particular exported file be safely dropped in a cloud drive".
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly databaseService = inject(DatabaseService);

  async getExportEncryptionDefault(): Promise<boolean> {
    const db = await this.databaseService.getDatabase();
    const settings = await getAppSettingsDoc(db);
    return settings?.exportEncryptionDefault ?? DEFAULT_APP_SETTINGS.exportEncryptionDefault;
  }

  async exportBackup(encrypt: boolean, password: string): Promise<Blob> {
    const db = await this.databaseService.getDatabase();
    const dump = await db.exportJSON();
    const envelope: BackupEnvelope = encrypt
      ? {
          format: BACKUP_FORMAT,
          version: BACKUP_VERSION,
          encrypted: true,
          payload: encryptString(JSON.stringify(dump), password),
        }
      : { format: BACKUP_FORMAT, version: BACKUP_VERSION, encrypted: false, payload: dump };

    await this.rememberEncryptionDefault(encrypt);

    return new Blob([JSON.stringify(envelope)], { type: 'application/json' });
  }

  /**
   * Decodes and validates `fileText` before touching any stored data — a wrong
   * password or a corrupted/foreign file must never wipe the current dataset.
   * Only once a usable dump is in hand does this reset the database (RxDB's
   * json-dump import writes raw inserts rather than clearing collections first,
   * so importing into a non-empty database would leave stray docs behind
   * instead of matching the dump exactly).
   *
   * Reopening after reset re-triggers DatabaseService's first-run convenience
   * of auto-seeding the default category taxonomy into the now-empty
   * `categories` collection (see seedDefaultCategoriesIfEmpty) — appropriate
   * for a genuinely fresh install, but not here: the dump is about to supply
   * the complete category set, including whatever the user did to their
   * defaults before exporting. Clearing it back out first keeps the import
   * the sole source of truth, exactly as it is for every other collection.
   */
  async importBackup(fileText: string, password: string | null): Promise<void> {
    const dump = this.decodeBackup(fileText, password);

    await this.databaseService.resetDatabase();
    const db = await this.databaseService.getDatabase();
    await db.categories.find().remove();
    await db.importJSON(dump);
  }

  private decodeBackup(fileText: string, password: string | null): SpearmintDump {
    const envelope = this.parseEnvelope(fileText);

    if (!envelope.encrypted) {
      return envelope.payload as SpearmintDump;
    }
    if (!password) {
      throw new Error('This backup is encrypted — enter the password to import it.');
    }
    try {
      const decrypted = decryptString(envelope.payload as string, password);
      if (!decrypted) {
        throw new Error('empty decryption result');
      }
      return JSON.parse(decrypted) as SpearmintDump;
    } catch {
      throw new Error('Incorrect password, or the backup file is corrupted.');
    }
  }

  private parseEnvelope(fileText: string): BackupEnvelope {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fileText);
    } catch {
      throw new Error('That file is not a valid Spearmint backup.');
    }
    const envelope = parsed as Partial<BackupEnvelope> | null;
    if (
      !envelope ||
      typeof envelope !== 'object' ||
      envelope.format !== BACKUP_FORMAT ||
      envelope.version !== BACKUP_VERSION
    ) {
      throw new Error('That file is not a valid Spearmint backup.');
    }
    return envelope as BackupEnvelope;
  }

  private async rememberEncryptionDefault(encrypt: boolean): Promise<void> {
    const db = await this.databaseService.getDatabase();
    await upsertAppSettings(db, { exportEncryptionDefault: encrypt });
  }
}
