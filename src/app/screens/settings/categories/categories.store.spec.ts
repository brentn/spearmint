import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoriesService } from '../../../categories/categories.service';
import type { Category } from '../../../data/models';
import { CategoriesStore } from './categories.store';

describe('CategoriesStore', () => {
  let list: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let del: ReturnType<typeof vi.fn>;
  let store: CategoriesStore;

  beforeEach(async () => {
    list = vi.fn().mockResolvedValue([]);
    create = vi.fn().mockResolvedValue({ id: 'new-1', name: 'Housing', parentCategoryId: null, type: 'expense' });
    update = vi.fn().mockResolvedValue(undefined);
    del = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        CategoriesStore,
        { provide: CategoriesService, useValue: { list, create, update, delete: del } },
      ],
    });
    store = TestBed.inject(CategoriesStore);
    await vi.waitFor(() => expect(store.loading()).toBe(false));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads categories on construction', () => {
    expect(list).toHaveBeenCalledTimes(1);
    expect(store.categories()).toEqual([]);
  });

  it('topLevel returns only parentless categories, childrenOf returns a parent\'s direct children', async () => {
    const seeded: Category[] = [
      { id: 'p1', name: 'Housing', parentCategoryId: null, type: 'expense' },
      { id: 'c1', name: 'Rent', parentCategoryId: 'p1', type: 'expense' },
    ];
    list.mockResolvedValue(seeded);
    await store.refresh();

    expect(store.topLevel()).toEqual([seeded[0]]);
    expect(store.childrenOf('p1')).toEqual([seeded[1]]);
    expect(store.childrenOf('c1')).toEqual([]);
  });

  it('addTopLevel creates a parentless category of the given type and refreshes', async () => {
    await store.addTopLevel('Housing', 'expense');

    expect(create).toHaveBeenCalledWith({ name: 'Housing', parentCategoryId: null, type: 'expense' });
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('addSubcategory inherits its parent\'s type', async () => {
    list.mockResolvedValue([{ id: 'p1', name: 'Income', parentCategoryId: null, type: 'income' }]);
    await store.refresh();

    await store.addSubcategory('p1', 'Paycheck');

    expect(create).toHaveBeenCalledWith({ name: 'Paycheck', parentCategoryId: 'p1', type: 'income' });
  });

  it('surfaces a create validation error without throwing', async () => {
    create.mockRejectedValue(new Error('A category named "Housing" already exists under this parent.'));

    await store.addTopLevel('Housing', 'expense');

    expect(store.error()).toBe('A category named "Housing" already exists under this parent.');
  });

  it('rename patches the category in place with its existing parent and type', async () => {
    list.mockResolvedValue([{ id: 'c1', name: 'Old Name', parentCategoryId: 'p1', type: 'expense' }]);
    await store.refresh();

    await store.rename('c1', 'New Name');

    expect(update).toHaveBeenCalledWith('c1', { name: 'New Name', parentCategoryId: 'p1', type: 'expense' });
  });

  it('delete surfaces a delete-blocked validation error', async () => {
    del.mockRejectedValue(new Error('This category has subcategories — delete or move them first.'));

    await store.delete('p1');

    expect(store.error()).toBe('This category has subcategories — delete or move them first.');
  });

  it('delete removes the category and refreshes on success', async () => {
    await store.delete('leaf-1');

    expect(del).toHaveBeenCalledWith('leaf-1');
    expect(store.error()).toBeNull();
  });
});
