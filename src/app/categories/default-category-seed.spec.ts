import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { categorySchema } from '../data/schemas';
import type { Category } from '../data/models';
import type { SpearmintDatabase } from '../data/database.service';
import { DEFAULT_CATEGORY_SEEDS, seedDefaultCategoriesIfEmpty } from './default-category-seed';
import { validateCategoryWrite } from './category-validation.util';

describe('DEFAULT_CATEGORY_SEEDS', () => {
  const topLevel = DEFAULT_CATEGORY_SEEDS.filter((s) => s.parentName === null);

  it('has 13 top-level categories', () => {
    expect(topLevel).toHaveLength(13);
  });

  it('includes the named top-level categories from the spec', () => {
    expect(topLevel.map((s) => s.name)).toEqual([
      'Income',
      'Housing',
      'Transportation',
      'Food & Dining',
      'Bills & Utilities',
      'Entertainment',
      'Shopping',
      'Health & Fitness',
      'Personal Care',
      'Travel',
      'Gifts & Donations',
      'Miscellaneous',
      'Transfer',
    ]);
  });

  it('gives Income the income type and Transfer the transfer type; everything else expense', () => {
    for (const seed of DEFAULT_CATEGORY_SEEDS) {
      const topLevelName = seed.parentName ?? seed.name;
      const expectedType =
        topLevelName === 'Income' ? 'income' : topLevelName === 'Transfer' ? 'transfer' : 'expense';
      expect(seed.type, `${seed.name} under ${topLevelName}`).toBe(expectedType);
    }
  });

  it('lists every parent before its children, so seeding can resolve ids in one pass', () => {
    const seen = new Set<string>();
    for (const seed of DEFAULT_CATEGORY_SEEDS) {
      if (seed.parentName !== null) {
        expect(seen.has(seed.parentName), `${seed.parentName} seen before ${seed.name}`).toBe(true);
      }
      seen.add(seed.name);
    }
  });

  it('produces a tree that passes the hierarchy validator rule-by-rule as each entry is added', () => {
    const built: Category[] = [];
    const idByName = new Map<string, string>();
    for (const seed of DEFAULT_CATEGORY_SEEDS) {
      const parentCategoryId = seed.parentName ? (idByName.get(seed.parentName) ?? null) : null;
      const draft = { name: seed.name, parentCategoryId, type: seed.type };
      expect(validateCategoryWrite(built, draft), seed.name).toBeNull();
      const id = `id-${seed.name}`;
      idByName.set(seed.name, id);
      built.push({ id, name: seed.name, parentCategoryId, type: seed.type });
    }
  });
});

describe('seedDefaultCategoriesIfEmpty', () => {
  let rawDb: RxDatabase<{ categories: import('rxdb').RxCollection<Category> }>;
  let db: SpearmintDatabase;

  beforeEach(async () => {
    rawDb = await createRxDatabase({
      name: `default-category-seed-test-${Math.random().toString(36).slice(2)}`,
      storage: getRxStorageMemory(),
    });
    await rawDb.addCollections({ categories: { schema: categorySchema } });
    db = rawDb as unknown as SpearmintDatabase;
  });

  afterEach(async () => {
    await rawDb.remove();
  });

  it('inserts every seed entry into an empty collection', async () => {
    await seedDefaultCategoriesIfEmpty(db);

    const docs = await rawDb.categories.find().exec();
    expect(docs).toHaveLength(DEFAULT_CATEGORY_SEEDS.length);
  });

  it('links each subcategory to its parent by id, not by name', async () => {
    await seedDefaultCategoriesIfEmpty(db);

    const docs = (await rawDb.categories.find().exec()).map((d) => d.toJSON());
    const housing = docs.find((c) => c.name === 'Housing');
    const rent = docs.find((c) => c.name === 'Rent');
    expect(housing).toBeDefined();
    expect(rent?.parentCategoryId).toBe(housing?.id);
  });

  it('does nothing when categories already exist', async () => {
    await rawDb.categories.insert({ id: 'existing-1', name: 'Custom', parentCategoryId: null, type: 'expense' });

    await seedDefaultCategoriesIfEmpty(db);

    const docs = await rawDb.categories.find().exec();
    expect(docs).toHaveLength(1);
  });
});
