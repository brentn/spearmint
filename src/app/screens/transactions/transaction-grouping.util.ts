import type { DateOnly, Transaction, YearMonth } from '../../data/models';
import { addDaysUtc } from '../../simplefin/date-only.util';

export interface TransactionDayGroup {
  date: DateOnly;
  heading: string;
  transactions: Transaction[];
}

function formatDayHeading(date: DateOnly): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Groups by UTC calendar date, newest first, with Today/Yesterday relabeled per the visual spec. */
export function groupTransactionsByDay(transactions: Transaction[], today: DateOnly): TransactionDayGroup[] {
  const yesterday = addDaysUtc(today, -1);
  const byDate = new Map<DateOnly, Transaction[]>();
  for (const transaction of transactions) {
    const group = byDate.get(transaction.date);
    if (group) {
      group.push(transaction);
    } else {
      byDate.set(transaction.date, [transaction]);
    }
  }

  return [...byDate.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((date) => ({
      date,
      heading: date === today ? 'Today' : date === yesterday ? 'Yesterday' : formatDayHeading(date),
      transactions: byDate.get(date)!,
    }));
}

/** Total spend (positive number) for transactions dated within the given calendar month. */
export function totalSpentInMonth(transactions: Transaction[], yearMonth: YearMonth): number {
  return transactions
    .filter((t) => t.date.startsWith(yearMonth))
    .reduce((sum, t) => sum + (t.amount < 0 ? Math.abs(t.amount) : 0), 0);
}

export function countInMonth(transactions: Transaction[], yearMonth: YearMonth): number {
  return transactions.filter((t) => t.date.startsWith(yearMonth)).length;
}

/** Net signed change (deposits minus spend) for transactions dated within the given calendar month. */
export function netChangeInMonth(transactions: Transaction[], yearMonth: YearMonth): number {
  return transactions.filter((t) => t.date.startsWith(yearMonth)).reduce((sum, t) => sum + t.amount, 0);
}

export function filterUncategorized(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.categoryId === null);
}
