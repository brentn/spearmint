import { describe, expect, it } from 'vitest';
import type { Category } from '../data/models';
import { groupAndSortCategories } from './category-grouping.util';

function makeCategory(overrides: Partial<Category> = {}): Category {
  return { id: 'cat', name: 'Category', parentCategoryId: null, type: 'expense', ...overrides };
}

describe('groupAndSortCategories', () => {
  it('sorts parent groups alphabetically', () => {
    const categories: Category[] = [
      makeCategory({ id: 'shopping', name: 'Shopping' }),
      makeCategory({ id: 'bills', name: 'Bills & Utilities' }),
      makeCategory({ id: 'food', name: 'Food & Dining' }),
    ];

    const groups = groupAndSortCategories(categories);

    expect(groups.map((g) => g.label)).toEqual(['Bills & Utilities', 'Food & Dining', 'Shopping']);
  });

  it('sorts children alphabetically within each parent', () => {
    const categories: Category[] = [
      makeCategory({ id: 'housing', name: 'Housing' }),
      makeCategory({ id: 'rent', name: 'Rent', parentCategoryId: 'housing' }),
      makeCategory({ id: 'insurance', name: 'Home Insurance', parentCategoryId: 'housing' }),
      makeCategory({ id: 'mortgage', name: 'Mortgage', parentCategoryId: 'housing' }),
    ];

    const groups = groupAndSortCategories(categories);

    expect(groups).toHaveLength(1);
    expect(groups[0].options.map((o) => o.name)).toEqual(['Housing', 'Home Insurance', 'Mortgage', 'Rent']);
  });

  it('falls back to the parent itself as a single option when it has no children', () => {
    const categories: Category[] = [makeCategory({ id: 'misc', name: 'Miscellaneous' })];

    const groups = groupAndSortCategories(categories);

    expect(groups).toEqual([
      { label: 'Miscellaneous', options: [{ id: 'misc', name: 'Miscellaneous', displayName: 'Miscellaneous' }] },
    ]);
  });

  it('offers the parent itself as the first, unprefixed option when it has children', () => {
    const categories: Category[] = [
      makeCategory({ id: 'housing', name: 'Housing' }),
      makeCategory({ id: 'rent', name: 'Rent', parentCategoryId: 'housing' }),
    ];

    const groups = groupAndSortCategories(categories);

    expect(groups).toEqual([
      {
        label: 'Housing',
        options: [
          { id: 'housing', name: 'Housing', displayName: 'Housing' },
          { id: 'rent', name: 'Rent', displayName: ' | Rent' },
        ],
      },
    ]);
  });

  it('places the parent option before its subcategories regardless of subcategory sort order', () => {
    const categories: Category[] = [
      makeCategory({ id: 'housing', name: 'Housing' }),
      makeCategory({ id: 'rent', name: 'Rent', parentCategoryId: 'housing' }),
      makeCategory({ id: 'insurance', name: 'Home Insurance', parentCategoryId: 'housing' }),
    ];

    const groups = groupAndSortCategories(categories);

    expect(groups[0].options.map((o) => o.id)).toEqual(['housing', 'insurance', 'rent']);
  });
});
