import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { categorySchema } from '../data/schemas';
import { DatabaseService } from '../data/database.service';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  let fakeDb: RxDatabase;
  let service: CategoriesService;

  beforeEach(async () => {
    fakeDb = await createRxDatabase({
      name: `categories-service-test-${Math.random().toString(36).slice(2)}`,
      storage: getRxStorageMemory(),
    });
    await fakeDb.addCollections({ categories: { schema: categorySchema } });

    TestBed.configureTestingModule({
      providers: [
        CategoriesService,
        { provide: DatabaseService, useValue: { getDatabase: () => Promise.resolve(fakeDb) } },
      ],
    });
    service = TestBed.inject(CategoriesService);
  });

  afterEach(async () => {
    await fakeDb.remove();
  });

  describe('list', () => {
    it('returns every stored category', async () => {
      await fakeDb['categories'].insert({ id: 'c1', name: 'Housing', parentCategoryId: null, type: 'expense' });

      expect(await service.list()).toEqual([
        { id: 'c1', name: 'Housing', parentCategoryId: null, type: 'expense' },
      ]);
    });
  });

  describe('create', () => {
    it('inserts a valid category and returns it', async () => {
      const created = await service.create({ name: 'Housing', parentCategoryId: null, type: 'expense' });

      expect(created.name).toBe('Housing');
      expect(await service.list()).toHaveLength(1);
    });

    it('rejects a duplicate sibling name without writing to the database', async () => {
      await service.create({ name: 'Housing', parentCategoryId: null, type: 'expense' });

      await expect(service.create({ name: 'Housing', parentCategoryId: null, type: 'expense' })).rejects.toThrow(
        'A category named "Housing" already exists under this parent.',
      );
      expect(await service.list()).toHaveLength(1);
    });

    it('rejects a parent/child type mismatch', async () => {
      const parent = await service.create({ name: 'Income', parentCategoryId: null, type: 'income' });

      await expect(
        service.create({ name: 'Groceries', parentCategoryId: parent.id, type: 'expense' }),
      ).rejects.toThrow("A category's type must match its parent's type.");
    });
  });

  describe('update', () => {
    it('patches a category in place', async () => {
      const created = await service.create({ name: 'Housing', parentCategoryId: null, type: 'expense' });

      await service.update(created.id, { name: 'Home', parentCategoryId: null, type: 'expense' });

      expect((await service.list())[0].name).toBe('Home');
    });

    it('rejects re-parenting a category under its own descendant (cycle detection)', async () => {
      const parent = await service.create({ name: 'Housing', parentCategoryId: null, type: 'expense' });
      const child = await service.create({ name: 'Rent', parentCategoryId: parent.id, type: 'expense' });

      await expect(
        service.update(parent.id, { name: 'Housing', parentCategoryId: child.id, type: 'expense' }),
      ).rejects.toThrow('Moving this category here would create a cycle.');
    });
  });

  describe('delete', () => {
    it('removes a leaf category', async () => {
      const created = await service.create({ name: 'Housing', parentCategoryId: null, type: 'expense' });

      await service.delete(created.id);

      expect(await service.list()).toHaveLength(0);
    });

    it('blocks deleting a category that still has subcategories', async () => {
      const parent = await service.create({ name: 'Housing', parentCategoryId: null, type: 'expense' });
      await service.create({ name: 'Rent', parentCategoryId: parent.id, type: 'expense' });

      await expect(service.delete(parent.id)).rejects.toThrow(
        'This category has subcategories — delete or move them first.',
      );
      expect(await service.list()).toHaveLength(2);
    });
  });
});
