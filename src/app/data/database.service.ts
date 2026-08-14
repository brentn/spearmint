import { Injectable, Injector, inject } from '@angular/core';
import { RxCollection, RxDatabase, RxStorage, addRxPlugin, createRxDatabase } from 'rxdb';
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

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private readonly injector = inject(Injector);
  private databasePromise: Promise<SpearmintDatabase> | null = null;

  getDatabase(): Promise<SpearmintDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = this.createDatabase();
    }
    return this.databasePromise;
  }

  private async createDatabase(): Promise<SpearmintDatabase> {
    let storage: RxStorage<unknown, unknown> = getRxStorageDexie();

    if (isDevMode()) {
      const [{ RxDBDevModePlugin }, { wrappedValidateAjvStorage }] = await Promise.all([
        import('rxdb/plugins/dev-mode'),
        import('rxdb/plugins/validate-ajv'),
      ]);
      addRxPlugin(RxDBDevModePlugin);
      // Dev-mode requires the storage to validate writes against the schema.
      storage = wrappedValidateAjvStorage({ storage });
    }

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

    // addCollections awaits each collection's migration (RxDB's autoMigrate
    // default) before resolving, so any pre-existing local data is already in
    // its new shape by the time callers read from the returned db.
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

    await seedDefaultCategoriesIfEmpty(db);

    return db;
  }
}
