import { describe, expect, it } from 'vitest';
import type { Category } from '../data/models';
import {
  hasSubcategories,
  validateCategoryDelete,
  validateCategoryWrite,
} from './category-validation.util';

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Groceries',
    parentCategoryId: null,
    type: 'expense',
    ...overrides,
  };
}

describe('validateCategoryWrite', () => {
  it('allows a valid top-level category', () => {
    const categories: Category[] = [];
    expect(
      validateCategoryWrite(categories, { name: 'Housing', parentCategoryId: null, type: 'expense' }),
    ).toBeNull();
  });

  it('allows a valid subcategory whose type matches its parent', () => {
    const categories = [category({ id: 'parent-1', name: 'Housing', parentCategoryId: null, type: 'expense' })];
    expect(
      validateCategoryWrite(categories, { name: 'Rent', parentCategoryId: 'parent-1', type: 'expense' }),
    ).toBeNull();
  });

  it('rejects a parent id that does not exist', () => {
    const categories: Category[] = [];
    expect(
      validateCategoryWrite(categories, { name: 'Rent', parentCategoryId: 'missing', type: 'expense' }),
    ).toBe('Parent category not found.');
  });

  it('rejects a subcategory whose type does not match its parent (parent/child type match)', () => {
    const categories = [category({ id: 'parent-1', name: 'Income', parentCategoryId: null, type: 'income' })];
    expect(
      validateCategoryWrite(categories, { name: 'Groceries', parentCategoryId: 'parent-1', type: 'expense' }),
    ).toBe("A category's type must match its parent's type.");
  });

  it('rejects a duplicate name among siblings (sibling duplicate-name rejection)', () => {
    const categories = [
      category({ id: 'parent-1', name: 'Food & Dining', parentCategoryId: null, type: 'expense' }),
      category({ id: 'sibling-1', name: 'Groceries', parentCategoryId: 'parent-1', type: 'expense' }),
    ];
    expect(
      validateCategoryWrite(categories, { name: 'Groceries', parentCategoryId: 'parent-1', type: 'expense' }),
    ).toBe('A category named "Groceries" already exists under this parent.');
  });

  it('name comparison for sibling duplicates is case-insensitive and trims whitespace', () => {
    const categories = [
      category({ id: 'parent-1', name: 'Food & Dining', parentCategoryId: null, type: 'expense' }),
      category({ id: 'sibling-1', name: 'Groceries', parentCategoryId: 'parent-1', type: 'expense' }),
    ];
    expect(
      validateCategoryWrite(categories, { name: '  groceries  ', parentCategoryId: 'parent-1', type: 'expense' }),
    ).toBe('A category named "  groceries  " already exists under this parent.');
  });

  it('allows the same name under a different parent', () => {
    const categories = [
      category({ id: 'parent-1', name: 'Food & Dining', parentCategoryId: null, type: 'expense' }),
      category({ id: 'parent-2', name: 'Shopping', parentCategoryId: null, type: 'expense' }),
      category({ id: 'sibling-1', name: 'Groceries', parentCategoryId: 'parent-1', type: 'expense' }),
    ];
    expect(
      validateCategoryWrite(categories, { name: 'Groceries', parentCategoryId: 'parent-2', type: 'expense' }),
    ).toBeNull();
  });

  it('excludes the category being updated from the duplicate-name check against itself', () => {
    const categories = [
      category({ id: 'parent-1', name: 'Food & Dining', parentCategoryId: null, type: 'expense' }),
      category({ id: 'cat-1', name: 'Groceries', parentCategoryId: 'parent-1', type: 'expense' }),
    ];
    expect(
      validateCategoryWrite(
        categories,
        { name: 'Groceries', parentCategoryId: 'parent-1', type: 'expense' },
        'cat-1',
      ),
    ).toBeNull();
  });

  it('rejects re-parenting a category under itself (cycle detection)', () => {
    const categories = [category({ id: 'cat-1', name: 'Housing', parentCategoryId: null, type: 'expense' })];
    expect(
      validateCategoryWrite(categories, { name: 'Housing', parentCategoryId: 'cat-1', type: 'expense' }, 'cat-1'),
    ).toBe('Moving this category here would create a cycle.');
  });

  it('rejects re-parenting a category under its own descendant (cycle detection)', () => {
    const categories = [
      category({ id: 'grandparent', name: 'Housing', parentCategoryId: null, type: 'expense' }),
      category({ id: 'parent', name: 'Rent', parentCategoryId: 'grandparent', type: 'expense' }),
      category({ id: 'child', name: 'Deposit', parentCategoryId: 'parent', type: 'expense' }),
    ];
    expect(
      validateCategoryWrite(
        categories,
        { name: 'Housing', parentCategoryId: 'child', type: 'expense' },
        'grandparent',
      ),
    ).toBe('Moving this category here would create a cycle.');
  });

  it('does not run cycle detection for a brand-new category (no existingId)', () => {
    const categories = [category({ id: 'cat-1', name: 'Housing', parentCategoryId: null, type: 'expense' })];
    expect(
      validateCategoryWrite(categories, { name: 'Rent', parentCategoryId: 'cat-1', type: 'expense' }),
    ).toBeNull();
  });
});

describe('hasSubcategories', () => {
  it('is true when another category points at it as a parent', () => {
    const categories = [
      category({ id: 'parent-1', name: 'Housing', parentCategoryId: null, type: 'expense' }),
      category({ id: 'child-1', name: 'Rent', parentCategoryId: 'parent-1', type: 'expense' }),
    ];
    expect(hasSubcategories(categories, 'parent-1')).toBe(true);
  });

  it('is false for a leaf category', () => {
    const categories = [category({ id: 'leaf-1', name: 'Rent', parentCategoryId: null, type: 'expense' })];
    expect(hasSubcategories(categories, 'leaf-1')).toBe(false);
  });
});

describe('validateCategoryDelete', () => {
  it('blocks deletion when the category has subcategories (delete-blocked-if-has-subcategories)', () => {
    const categories = [
      category({ id: 'parent-1', name: 'Housing', parentCategoryId: null, type: 'expense' }),
      category({ id: 'child-1', name: 'Rent', parentCategoryId: 'parent-1', type: 'expense' }),
    ];
    expect(validateCategoryDelete(categories, 'parent-1')).toBe(
      "This category has subcategories — delete or move them first.",
    );
  });

  it('allows deletion of a leaf category', () => {
    const categories = [category({ id: 'leaf-1', name: 'Rent', parentCategoryId: null, type: 'expense' })];
    expect(validateCategoryDelete(categories, 'leaf-1')).toBeNull();
  });
});
