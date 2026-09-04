import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import type { SpearmintCollections } from '../data/database.service';
import { collectionsConfig } from '../data/schemas';

collectionsConfig satisfies Record<
  keyof SpearmintCollections,
  { schema: unknown; migrationStrategies?: unknown }
>;

export type TestCollectionName = keyof typeof collectionsConfig;

/**
 * Boots an in-memory, schema-validating RxDB database carrying only the named collections —
 * the bootstrap every spec in this suite used to hand-roll (createRxDatabase +
 * wrappedValidateAjvStorage(getRxStorageMemory())), each with its own copy-pasted subset of
 * the production schemas. Collection names are checked against the real schema registry, so a
 * typo is a compile error instead of a runtime one. The returned database is intentionally
 * untyped (like the rest of this suite's fakeDb) — read its collections via bracket notation,
 * e.g. `db['accounts']`.
 */
export async function createTestDatabase(
  ...collectionNames: TestCollectionName[]
): Promise<RxDatabase> {
  const db = await createRxDatabase({
    name: `spearmint-test-${Math.random().toString(36).slice(2)}`,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
  const config = Object.fromEntries(collectionNames.map((name) => [name, collectionsConfig[name]]));
  await db.addCollections(config);
  return db;
}
