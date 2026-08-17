import type { AppSettings } from './models';
import type { SpearmintDatabase } from './database.service';

export const DEFAULT_APP_SETTINGS: Omit<AppSettings, 'webauthnCredential' | 'passwordHash'> = {
  id: 'settings',
  lastSyncDate: null,
  ignoredExternalAccounts: [],
  exportEncryptionDefault: false,
  biometricsEnabled: false,
};

export function getAppSettingsDoc(db: SpearmintDatabase) {
  return db.appSettings.findOne('settings').exec();
}

/** Patches the singleton settings doc, inserting it (seeded with defaults) if it
 * doesn't exist yet — every caller that writes a single AppSettings field needs
 * this same "doc may not exist on a brand-new install" branch. */
export async function upsertAppSettings(
  db: SpearmintDatabase,
  patch: Partial<Omit<AppSettings, 'id'>>
): Promise<void> {
  const existing = await getAppSettingsDoc(db);
  if (existing) {
    await existing.incrementalPatch(patch);
    return;
  }
  await db.appSettings.insert({ ...DEFAULT_APP_SETTINGS, webauthnCredential: null, passwordHash: null, ...patch });
}
