import { describe, expect, it } from 'vitest';
import type { Category } from '../data/models';
import { buildCategoryOptions } from './category-grouping.util';

function makeCategory(overrides: Partial<Category> = {}): Category {
  return { id: 'cat', name: 'Category', parentCategoryId: null, type: 'expense', ...overrides };
}

describe('buildCategoryOptions', () => {
  it('sorts top-level categories alphabetically', () => {
    const categories: Category[] = [
      makeCategory({ id: 'shopping', name: 'Shopping' }),
      makeCategory({ id: 'bills', name: 'Bills & Utilities' }),
      makeCategory({ id: 'food', name: 'Food & Dining' }),
    ];

    const options = buildCategoryOptions(categories);

    expect(options.map((o) => o.label)).toEqual(['Bills & Utilities', 'Food & Dining', 'Shopping']);
  });

  it('prefixes a child option with its parent name', () => {
    const categories: Category[] = [
      makeCategory({ id: 'housing', name: 'Housing' }),
      makeCategory({ id: 'rent', name: 'Rent', parentCategoryId: 'housing' }),
    ];

    const options = buildCategoryOptions(categories);

    expect(options.find((o) => o.id === 'rent')?.label).toBe('Housing: Rent');
  });

  it('does not double up the parent name when the child name already contains it', () => {
    const categories: Category[] = [
      makeCategory({ id: 'auto', name: 'Auto' }),
      makeCategory({ id: 'auto-insurance', name: 'Auto Insurance', parentCategoryId: 'auto' }),
    ];

    const options = buildCategoryOptions(categories);

    expect(options.find((o) => o.id === 'auto-insurance')?.label).toBe('Auto Insurance');
  });

  it('places a parent immediately before its own children once prefixed, without a separate group header', () => {
    const categories: Category[] = [
      makeCategory({ id: 'housing', name: 'Housing' }),
      makeCategory({ id: 'rent', name: 'Rent', parentCategoryId: 'housing' }),
      makeCategory({ id: 'insurance', name: 'Home Insurance', parentCategoryId: 'housing' }),
    ];

    const options = buildCategoryOptions(categories);

    expect(options.map((o) => o.id)).toEqual(['housing', 'insurance', 'rent']);
  });

  it('keeps a parent with no children as a single bare option', () => {
    const categories: Category[] = [makeCategory({ id: 'misc', name: 'Miscellaneous' })];

    expect(buildCategoryOptions(categories)).toEqual([{ id: 'misc', label: 'Miscellaneous' }]);
  });
});
