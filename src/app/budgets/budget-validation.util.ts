import type { Category } from '../data/models';

export interface BudgetWriteDraft {
  amount: number;
  rollOver: boolean;
  /** Present only when manually overriding this period's rollover amount — requires `rollOver`. */
  rolloverAmount?: number;
}

/** Validates a budget create/update against its category — no rollover toggle for Income. */
export function validateBudgetWrite(category: Category, draft: BudgetWriteDraft): string | null {
  if (draft.rollOver && category.type === 'income') {
    return 'Income budgets cannot roll over.';
  }
  if (draft.amount < 0) {
    return 'Budget amount must be greater than or equal to 0.';
  }
  if (draft.rolloverAmount !== undefined && !draft.rollOver) {
    return 'Turn on rollover before setting a rollover amount.';
  }
  return null;
}
