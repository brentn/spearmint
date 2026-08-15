import { InjectionToken, Injectable, Injector, inject } from '@angular/core';
import { RxCollection, RxDatabase, RxError, RxStorage, addRxPlugin, createRxDatabase, removeRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { AngularSignalReactivityLambda, createReactivityFactory } from 'rxdb/plugins/reactivity-angular';
import { isDevMode } from '@angular/core';
import type {
  Account,
  AppSettings,
  Budget,
  Category,
  CategorizationRule,
  Institution,
  SimplefinLink,
  Transaction,
} from './models';
import {
  accountSchema,
  appSettingsMigrationStrategies,
  appSettingsSchema,
  budgetSchema,
  categorizationRuleSchema,
  categorySchema,
  institutionSchema,
  simplefinLinkSchema,
  transactionSchema,
} from './schemas';
import { seedDefaultCategoriesIfEmpty } from '../categories/default-category-seed';

export type SpearmintCollections = {
  institutions: RxCollection<Institution>;
  accounts: RxCollection<Account>;
  categories: RxCollection<Category>;
  transactions: RxCollection<Transaction>;
  budgets: RxCollection<Budget>;
  categorizationRules: RxCollection<CategorizationRule>;
  appSettings: RxCollection<AppSettings>;
  simplefinLinks: RxCollection<SimplefinLink>;
};

export type SpearmintDatabase = RxDatabase<SpearmintCollections, unknown, unknown, AngularSignalReactivityLambda>;

const DATABASE_NAME = 'spearmint';

// Overridable so tests can swap in RxDB's memory storage via a TestBed
// provider instead of vi.mock()'ing this module (see database.service.spec.ts
// for why the mock approach was unreliable).
export const RX_STORAGE = new InjectionToken<RxStorage<unknown, unknown>>('RX_STORAGE', {
  providedIn: 'root',
  factory: () => getRxStorageDexie(),
});

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private readonly injector = inject(Injector);
  private readonly baseStorage = inject(RX_STORAGE);
  private databasePromise: Promise<SpearmintDatabase> | null = null;

  getDatabase(): Promise<SpearmintDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = this.createDatabase();
    }
    return this.databasePromise;
  }

  /** Permanently deletes every local collection's data. Callers should reload the app
   * afterward — this only closes and wipes the database, it doesn't reset in-memory
   * app state (signals, WebAuthn unlock, etc.) that assumed the old data existed. */
  async resetDatabase(): Promise<void> {
    const db = await this.getDatabase();
    await db.remove();
    this.databasePromise = null;
  }

  private async createDatabase(): Promise<SpearmintDatabase> {
    const storage = await this.buildStorage();

    try {
      return await this.openDatabase(storage);
    } catch (error) {
      if (!(error instanceof RxError) || error.code !== 'DM5') {
        throw error;
      }
      // DM5: RxDB refuses to open a database whose internal storage state was
      // written by an incompatible major version. This is not a domain schema
      // change (those go through the migrationStrategies above and are never
      // silently discarded) — it's RxDB's own format guard, and the only way
      // to hit it here is a database left over from the pre-rebuild Spearmint
      // app on the same default dev-server origin, which used RxDB 15 before
      // this rebuild's first commit ever ran. The rebuild spec already
      // decided that transition has no migration path, so reset silently
      // rather than surfacing an error for data from an app that no longer
      // exists in this codebase.
      await removeRxDatabase(DATABASE_NAME, storage);
      return this.openDatabase(storage);
    }
  }

  private async buildStorage(): Promise<RxStorage<unknown, unknown>> {
    let storage: RxStorage<unknown, unknown> = this.baseStorage;

    if (isDevMode()) {
      const [{ RxDBDevModePlugin }, { wrappedValidateAjvStorage }] = await Promise.all([
        import('rxdb/plugins/dev-mode'),
        import('rxdb/plugins/validate-ajv'),
      ]);
      addRxPlugin(RxDBDevModePlugin);
      // Dev-mode requires the storage to validate writes against the schema.
      storage = wrappedValidateAjvStorage({ storage });
    }

    return storage;
  }

  private async openDatabase(storage: RxStorage<unknown, unknown>): Promise<SpearmintDatabase> {
    const db: SpearmintDatabase = await createRxDatabase<SpearmintCollections, unknown, unknown, AngularSignalReactivityLambda>({
      name: DATABASE_NAME,
      storage,
      reactivity: createReactivityFactory(this.injector),
      // This app never runs more than one tab's worth of local-only state at a
      // time; multiInstance's BroadcastChannel leader election (used to avoid
      // duplicate migrations across tabs) adds startup latency and a hang risk
      // for no benefit here.
      multiInstance: false,
    });

    try {
      // addCollections awaits each collection's migration (RxDB's autoMigrate
      // default) before resolving, so any pre-existing local data is already
      // in its new shape by the time callers read from the returned db. It's
      // also where a DM5 startup error (see createDatabase()) actually
      // surfaces — createRxDatabase() above succeeds regardless.
      await db.addCollections({
        institutions: { schema: institutionSchema },
        accounts: { schema: accountSchema },
        categories: { schema: categorySchema },
        transactions: { schema: transactionSchema },
        budgets: { schema: budgetSchema },
        categorizationRules: { schema: categorizationRuleSchema },
        appSettings: { schema: appSettingsSchema, migrationStrategies: appSettingsMigrationStrategies },
        simplefinLinks: { schema: simplefinLinkSchema },
      });
    } catch (error) {
      // Close this half-open instance so it doesn't linger registered under
      // this name — otherwise a DM5 retry's fresh createRxDatabase() call
      // would immediately fail with DB8 ("name already in use").
      await db.close();
      throw error;
    }

    await seedDefaultCategoriesIfEmpty(db);

    return db;
  }
}
