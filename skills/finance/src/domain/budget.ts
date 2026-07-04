// Pure finance math — no I/O, no hidden clock (docs/02 §8: caller passes `now`).
// Category names are matched on a normalized key so "Groceries" and "groceries"
// aggregate together, the same normalization Workout uses for exercise names.

import type {
  BudgetLimit,
  CategorySpend,
  RecurringPayment,
  Transaction,
} from './types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Total income, expense, and net (income − expense) for a set of transactions. */
export function netForPeriod(transactions: Transaction[]): {
  totalIncomeMinor: number;
  totalExpenseMinor: number;
  netMinor: number;
} {
  let totalIncomeMinor = 0;
  let totalExpenseMinor = 0;
  for (const t of transactions) {
    if (t.type === 'income') totalIncomeMinor += t.amountMinor;
    else totalExpenseMinor += t.amountMinor;
  }
  return { totalIncomeMinor, totalExpenseMinor, netMinor: totalIncomeMinor - totalExpenseMinor };
}

/** Per-category expense totals with their budget limit (if any) and over-budget flag.
 *  Categories appear if they have spend OR a configured limit, so an unused budget
 *  still surfaces at 0 spent. Income transactions are ignored here. */
export function computeCategorySpend(
  transactions: Transaction[],
  budgets: BudgetLimit[],
): CategorySpend[] {
  const spentByCat = new Map<string, { name: string; spentMinor: number }>();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const key = normalizeCategoryName(t.categoryName);
    const existing = spentByCat.get(key);
    if (existing) existing.spentMinor += t.amountMinor;
    else spentByCat.set(key, { name: t.categoryName, spentMinor: t.amountMinor });
  }

  const limitByCat = new Map<string, BudgetLimit>();
  for (const b of budgets) limitByCat.set(normalizeCategoryName(b.categoryName), b);

  const keys = new Set<string>([...spentByCat.keys(), ...limitByCat.keys()]);
  const result: CategorySpend[] = [];
  for (const key of keys) {
    const spent = spentByCat.get(key);
    const limit = limitByCat.get(key);
    const spentMinor = spent?.spentMinor ?? 0;
    const limitMinor = limit?.monthlyLimitMinor;
    result.push({
      categoryName: spent?.name ?? limit!.categoryName,
      spentMinor,
      limitMinor,
      overBudget: limitMinor != null && spentMinor > limitMinor,
    });
  }
  return result.sort((a, b) => b.spentMinor - a.spentMinor);
}

function addInterval(date: string, interval: RecurringPayment['interval']): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (interval === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else if (interval === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/** Rolls a bill's nextDueDate forward until it is in the future relative to `now`,
 *  so a monthly bill whose date has passed reports its *next* real occurrence
 *  without any background job. Returns the (possibly advanced) due date. */
export function nextOccurrenceOnOrAfter(bill: RecurringPayment, now: string): string {
  const today = now.slice(0, 10);
  let due = bill.nextDueDate;
  // Guard against pathological input; intervals are always positive so this converges.
  let guard = 0;
  while (due < today && guard < 1000) {
    due = addInterval(due, bill.interval);
    guard += 1;
  }
  return due;
}

/** Active bills whose next occurrence falls within `daysAhead` of `now`, each with
 *  its reactively-advanced nextDueDate, soonest first. */
export function upcomingBillsWithin(
  bills: RecurringPayment[],
  now: string,
  daysAhead: number,
): RecurringPayment[] {
  const today = now.slice(0, 10);
  const horizon = new Date(new Date(`${today}T00:00:00Z`).getTime() + daysAhead * DAY_MS)
    .toISOString()
    .slice(0, 10);
  return bills
    .filter((b) => b.active)
    .map((b) => ({ ...b, nextDueDate: nextOccurrenceOnOrAfter(b, now) }))
    .filter((b) => b.nextDueDate <= horizon)
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
}
