import type { Category } from '../data/models';

/** The shape of a budget create/update, shared by BudgetsService.setForPeriod and its
 * validation here — one write shape for both "add" and "edit," any period. */
export interface BudgetWrite {
  amount: number;
  rollOver: boolean;
  /** Present only to set a sticky manual rollover override for this exact period (requires
   * `rollOver`) — see recomputeRollovers' doc for what "sticky" means. */
  rolloverAmount?: number;
}

/** Validates a budget create/update against its category — no rollover toggle for Income. */
export function validateBudgetWrite(category: Category, draft: BudgetWrite): string | null {
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
