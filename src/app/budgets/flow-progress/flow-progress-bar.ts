import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import type { FlowProgressRow } from '../budget-engine.util';

/**
 * A single row of the income/expenses progress widget (issue #42): a name/amount line above the
 * bar (matching BudgetRow's own amount-line styling) and a bar split into a solid (categorized)
 * segment and a dim/crosshatched (uncategorized) segment, stacked to the combined total. Shared
 * by the two-row FlowProgress widget and by the standalone expenses-bar preview atop Budgets'
 * "Spending by category" section.
 */
@Component({
  selector: 'app-flow-progress-bar',
  imports: [DecimalPipe],
  templateUrl: './flow-progress-bar.html',
  styleUrl: './flow-progress-bar.scss',
})
export class FlowProgressBar {
  readonly row = input.required<FlowProgressRow>();
  /** e.g. "Incoming" / "Outgoing" — shown above the left side of the bar. */
  readonly label = input.required<string>();
  /** Shows the elapsed-month-fraction tick (Budgets hero only, issue #23) — anchored to this
   * row's own bar-track regardless of the label line above it. */
  readonly showTodayTick = input(false);
  readonly todayPercent = input(0);

  /** flex-grow values for the two segments — both amounts when there's actual activity to
   * split, otherwise a full solid segment so a $0-budget/$0-actual row still renders a visible
   * bar rather than nothing at all. Magnitude only: CSS drops a negative flex-grow declaration
   * entirely (leaving both segments at their flex-basis of 0, i.e. invisible), so a reversed row
   * (negative totalActual) needs the absolute values here — same proportions either direction. */
  protected readonly segments = computed(() => {
    const row = this.row();
    if (row.totalActual === 0) {
      return { categorized: 1, uncategorized: 0 };
    }
    return { categorized: Math.abs(row.categorizedActual), uncategorized: Math.abs(row.uncategorizedActual) };
  });
}
