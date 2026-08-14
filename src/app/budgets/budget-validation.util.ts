import type { Category } from '../data/models';

export interface BudgetWriteDraft {
  amount: number;
  rollOver: boolean;
}

/** Validates a budget create/update against its category (spec §4: no rollover toggle for Income). */
export function validateBudgetWrite(category: Category, draft: BudgetWriteDraft): string | null {
  if (draft.rollOver && category.type === 'income') {
    return 'Income budgets cannot roll over.';
  }
  if (draft.amount < 0) {
    return 'Budget amount must be greater than or equal to 0.';
  }
  return null;
}
