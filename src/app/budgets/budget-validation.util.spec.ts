import { describe, expect, it } from 'vitest';
import type { Category } from '../data/models';
import { validateBudgetWrite } from './budget-validation.util';

function category(overrides: Partial<Category> = {}): Category {
  return { id: 'cat-1', name: 'Groceries', parentCategoryId: null, type: 'expense', ...overrides };
}

describe('validateBudgetWrite', () => {
  it('allows a valid expense budget', () => {
    expect(validateBudgetWrite(category(), { amount: 500, rollOver: true })).toBeNull();
  });

  it('rejects rollOver on an income category (no rollover toggle for Income budgets)', () => {
    expect(
      validateBudgetWrite(category({ type: 'income' }), { amount: 4000, rollOver: true }),
    ).toBe('Income budgets cannot roll over.');
  });

  it('allows a non-rollover income budget', () => {
    expect(validateBudgetWrite(category({ type: 'income' }), { amount: 4000, rollOver: false })).toBeNull();
  });

  it('rejects a negative amount', () => {
    expect(validateBudgetWrite(category(), { amount: -1, rollOver: false })).toBe(
      'Budget amount must be greater than or equal to 0.',
    );
  });

  it('allows a zero amount', () => {
    expect(validateBudgetWrite(category(), { amount: 0, rollOver: false })).toBeNull();
  });

  it('allows a negative rolloverAmount when rollOver is on', () => {
    expect(validateBudgetWrite(category(), { amount: 500, rollOver: true, rolloverAmount: -40 })).toBeNull();
  });

  it('rejects a rolloverAmount when rollOver is off', () => {
    expect(validateBudgetWrite(category(), { amount: 500, rollOver: false, rolloverAmount: -40 })).toBe(
      'Turn on rollover before setting a rollover amount.',
    );
  });
});
