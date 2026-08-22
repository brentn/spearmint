import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import type { FlowProgressRow } from '../budget-engine.util';

/**
 * A single row of the income/expenses progress widget (issue #42): a bar split into a solid
 * (categorized) segment and a dim/crosshatched (uncategorized) segment, stacked to the combined
 * total, plus a "$actual of $budget" text line — or actual-only text when there's no budget
 * target. Shared by the two-row FlowProgress widget and by the standalone expenses-bar preview
 * atop Budgets' "Spending by category" section.
 */
@Component({
  selector: 'app-flow-progress-bar',
  imports: [DecimalPipe],
  templateUrl: './flow-progress-bar.html',
  styleUrl: './flow-progress-bar.scss',
})
export class FlowProgressBar {
  readonly row = input.required<FlowProgressRow>();

  /** flex-grow values for the two segments — both amounts when there's actual activity to
   * split, otherwise a full solid segment so a $0-budget/$0-actual row still renders a visible
   * bar rather than nothing at all. */
  protected readonly segments = computed(() => {
    const row = this.row();
    if (row.totalActual === 0) {
      return { categorized: 1, uncategorized: 0 };
    }
    return { categorized: row.categorizedActual, uncategorized: row.uncategorizedActual };
  });
}
