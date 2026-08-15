import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { BudgetRowViewModel } from '../budgets.store';

/**
 * A single category-budget row (name, spent-of-available, three-state bar), linking
 * to its Budget detail screen. Shared between the Budgets tab and the Overview tab's
 * "Budgets to watch" card — both render the same BudgetRowViewModel shape.
 */
@Component({
  selector: 'app-budget-row',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './budget-row.html',
  styleUrl: './budget-row.scss',
})
export class BudgetRow {
  readonly row = input.required<BudgetRowViewModel>();
  /** Indents a subcategory's row when shown alongside its parent (Budgets screen's "show subcategories" toggle). */
  readonly indent = input(false);
}
