import { Injectable, Injector, inject } from '@angular/core';
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
    const storage = await this.buildStorage();

    try {
      return await this.openDatabase(storage);
    } catch (error) {
      if (!(error instanceof RxError) || error.code !== 'DB6') {
        throw error;
      }
      // No migration path (spec §2): a schema change makes the existing local
      // database stale, not a candidate for a migration strategy. Drop it and
      // start fresh rather than leaving the user stuck on an unrecoverable
      // "another instance created this collection with a different schema" error.
      await removeRxDatabase(DATABASE_NAME, storage);
      return this.openDatabase(storage);
    }
  }

  private async buildStorage(): Promise<RxStorage<unknown, unknown>> {
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

    return storage;
  }

  private async openDatabase(storage: RxStorage<unknown, unknown>): Promise<SpearmintDatabase> {
    const db: SpearmintDatabase = await createRxDatabase<SpearmintCollections, unknown, unknown, AngularSignalReactivityLambda>({
      name: DATABASE_NAME,
      storage,
      reactivity: createReactivityFactory(this.injector),
    });

    try {
      await db.addCollections({
        institutions: { schema: institutionSchema },
        accounts: { schema: accountSchema },
        categories: { schema: categorySchema },
        transactions: { schema: transactionSchema },
        budgets: { schema: budgetSchema },
        categorizationRules: { schema: categorizationRuleSchema },
        appSettings: { schema: appSettingsSchema },
        simplefinLinks: { schema: simplefinLinkSchema },
      });
    } catch (error) {
      // Close this half-open instance first so a caller-side removeRxDatabase()
      // retry (on schema mismatch) isn't blocked by its still-open connections.
      await db.close();
      throw error;
    }

    await seedDefaultCategoriesIfEmpty(db);

    return db;
  }
}
