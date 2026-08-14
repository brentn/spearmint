import type { AppSettings } from './models';
import type { SpearmintDatabase } from './database.service';

export const DEFAULT_APP_SETTINGS: Omit<AppSettings, 'webauthnCredential'> = {
  id: 'settings',
  lastSyncDate: null,
  ignoredExternalAccounts: [],
  exportEncryptionDefault: false,
};

export function getAppSettingsDoc(db: SpearmintDatabase) {
  return db.appSettings.findOne('settings').exec();
}
