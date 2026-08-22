import type { AppSettings, IgnoredExternalAccount } from './models';
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

/** Permanently ignores a SimpleFIN external account (by its `connId:externalAccountId`
 * key) so the next sync's discovery pass never re-surfaces it — shared by both the
 * "ignore a newly discovered account" flow and real-account deletion (ADR-0017), since
 * both need the same append-if-absent behavior against the same list. */
export async function addIgnoredExternalAccountIfAbsent(
  db: SpearmintDatabase,
  entry: IgnoredExternalAccount
): Promise<void> {
  const settingsDoc = await getAppSettingsDoc(db);
  if (settingsDoc?.ignoredExternalAccounts.some((i) => i.key === entry.key)) {
    return;
  }
  await upsertAppSettings(db, {
    ignoredExternalAccounts: [...(settingsDoc?.ignoredExternalAccounts ?? []), entry],
  });
}
