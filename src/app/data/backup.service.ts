import { Injectable, inject } from '@angular/core';
import { addRxPlugin, type RxDumpDatabaseAny } from 'rxdb';
import { decryptString, encryptString } from 'rxdb/plugins/encryption-crypto-js';
import { RxDBJsonDumpPlugin } from 'rxdb/plugins/json-dump';
import { DEFAULT_APP_SETTINGS, getAppSettingsDoc, upsertAppSettings } from './app-settings.util';
import { DatabaseService, type SpearmintCollections } from './database.service';
import type { AppSettings } from './models';

// Registered here (not in DatabaseService, which every route loads eagerly) so
// db.exportJSON()/importJSON() and the crypto-js-backed encrypt/decrypt helpers
// above only enter the bundle when this file does — this module is only ever
// reached via the lazy-loaded Settings -> Export/Import route, and crypto-js
// alone is ~600kB unminified, enough on its own to blow the app's initial
// bundle-size budget if pulled into the eagerly-loaded main chunk instead.
addRxPlugin(RxDBJsonDumpPlugin);

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
 * Strips login credentials (`passwordHash`, `webauthnCredential`, `biometricsEnabled`)
 * out of the appSettings collection before a dump ever gets serialized to a file — even
 * an *encrypted* backup shouldn't carry another PBKDF2 hash+salt around, and a WebAuthn
 * credential is bound to the authenticator that created it, so it's meaningless on a
 * different device anyway. Safe to always do: importBackup() only ever runs from an
 * already-unlocked session (Settings is behind the auth gate), so there's always a real
 * login on the importing device already — the backup was never the credential's only
 * carrier, restoring it here would only ever *replace* a working login with an inert one.
 */
function stripAuthFields(dump: SpearmintDump): SpearmintDump {
  return {
    ...dump,
    collections: dump.collections.map((collection) =>
      collection.name === 'appSettings'
        ? {
            ...collection,
            docs: collection.docs.map((doc) => ({
              ...doc,
              passwordHash: null,
              webauthnCredential: null,
              biometricsEnabled: false,
            })),
          }
        : collection
    ),
  };
}

/**
 * Whole-dataset export/import — the app's only backup and only cross-device sync
 * mechanism (spec §5). Wraps RxDB's json-dump plugin (registered above) for the
 * actual collection dump/restore, plus an optional password-based AES layer
 * over the resulting blob: RxDB's own storage-level encryption would mean
 * re-creating the whole local database with a password, which is a different
 * feature (data-at-rest protection) than "can this particular exported file be
 * safely dropped in a cloud drive".
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
    const dump = stripAuthFields(await db.exportJSON());
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
   *
   * The dump's own appSettings.passwordHash/webauthnCredential/biometricsEnabled are
   * always stripped (see stripAuthFields) — importBackup() only ever runs from an
   * already-unlocked session, so this device's real login is captured before the reset
   * and reapplied after, rather than adopting the backup's (inert) auth fields.
   */
  async importBackup(fileText: string, password: string | null): Promise<void> {
    const dump = this.decodeBackup(fileText, password);
    const currentAuth = await this.captureAuthFields();

    await this.databaseService.resetDatabase();
    const db = await this.databaseService.getDatabase();
    await db.categories.find().remove();
    await db.importJSON(dump);
    if (currentAuth) {
      await upsertAppSettings(db, currentAuth);
    }
  }

  private async captureAuthFields(): Promise<Pick<
    AppSettings,
    'passwordHash' | 'webauthnCredential' | 'biometricsEnabled'
  > | null> {
    const db = await this.databaseService.getDatabase();
    const settings = await getAppSettingsDoc(db);
    if (!settings) {
      return null;
    }
    return {
      passwordHash: settings.passwordHash,
      webauthnCredential: settings.webauthnCredential,
      biometricsEnabled: settings.biometricsEnabled,
    };
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
