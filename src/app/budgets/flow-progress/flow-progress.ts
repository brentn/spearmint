import { Component, input } from '@angular/core';
import type { FlowProgressViewModel } from '../budget-engine.util';
import { FlowProgressBar } from './flow-progress-bar';

/**
 * The shared two-row income/expenses progress widget (issue #42) — an Income bar above an
 * Expenses bar, no text labels beyond the bars themselves. Used on the Overview screen and, with
 * `showTodayTick`, on the Budgets hero (replacing its old single-bar "Progress this month" card).
 */
@Component({
  selector: 'app-flow-progress',
  imports: [FlowProgressBar],
  templateUrl: './flow-progress.html',
  styleUrl: './flow-progress.scss',
})
export class FlowProgress {
  readonly progress = input.required<FlowProgressViewModel>();
  /** Shows the elapsed-month-fraction tick (Budgets hero only — issue #23's existing indicator). */
  readonly showTodayTick = input(false);
  readonly todayPercent = input(0);
}
