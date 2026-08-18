import type { Category, DateOnly, Transaction, YearMonth } from '../../data/models';
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

/** The label the list displays for a date — Today/Yesterday relabeled per the visual spec,
 * otherwise a short month/day. Shared by the day-group headings and by filterBySearch, so a date
 * search matches what's actually on screen rather than the raw stored ISO string alone. */
function dayHeading(date: DateOnly, today: DateOnly): string {
  const yesterday = addDaysUtc(today, -1);
  return date === today ? 'Today' : date === yesterday ? 'Yesterday' : formatDayHeading(date);
}

/** Groups by UTC calendar date, newest first, with Today/Yesterday relabeled per the visual spec. */
export function groupTransactionsByDay(transactions: Transaction[], today: DateOnly): TransactionDayGroup[] {
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
      heading: dayHeading(date, today),
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

export function filterByAccount(transactions: Transaction[], accountId: string): Transaction[] {
  return transactions.filter((t) => t.accountId === accountId);
}

/** Free-text search across the fields the row/edit-dialog surface: description, notes, date
 * (both the raw stored value and the "Today"/"Yesterday"/short-month-day label the list actually
 * displays), category name, and amount (matched with or without its sign, since the list displays
 * the unsigned amount). Empty/whitespace-only queries pass everything through unfiltered. */
export function filterBySearch(
  transactions: Transaction[],
  query: string,
  categories: Category[],
  today: DateOnly,
): Transaction[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return transactions;
  }
  return transactions.filter((t) => {
    if (t.description.toLowerCase().includes(needle)) {
      return true;
    }
    if (t.notes?.toLowerCase().includes(needle)) {
      return true;
    }
    if (t.date.includes(needle) || dayHeading(t.date, today).toLowerCase().includes(needle)) {
      return true;
    }
    const categoryName = t.categoryId ? (categories.find((c) => c.id === t.categoryId)?.name ?? 'Uncategorized') : 'Uncategorized';
    if (categoryName.toLowerCase().includes(needle)) {
      return true;
    }
    return t.amount.toFixed(2).includes(needle) || Math.abs(t.amount).toFixed(2).includes(needle);
  });
}
