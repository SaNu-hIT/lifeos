import { describe, expect, it } from 'vitest';
import {
  computeCategorySpend,
  netForPeriod,
  nextOccurrenceOnOrAfter,
  normalizeCategoryName,
  upcomingBillsWithin,
} from '../src/index.js';
import type { BudgetLimit, RecurringPayment, Transaction } from '../src/index.js';

function txn(over: Partial<Transaction>): Transaction {
  return {
    id: 't',
    userId: 'u1',
    type: 'expense',
    amountMinor: 1000,
    currency: 'INR',
    categoryName: 'Food',
    occurredAt: '2026-07-02T10:00:00Z',
    createdAt: '2026-07-02T10:00:00Z',
    ...over,
  };
}

describe('netForPeriod', () => {
  it('sums income and expense and computes net', () => {
    const result = netForPeriod([
      txn({ type: 'income', amountMinor: 50000 }),
      txn({ type: 'expense', amountMinor: 12000 }),
      txn({ type: 'expense', amountMinor: 8000 }),
    ]);
    expect(result).toEqual({ totalIncomeMinor: 50000, totalExpenseMinor: 20000, netMinor: 30000 });
  });
});

describe('computeCategorySpend', () => {
  it('aggregates case-insensitively and flags over-budget', () => {
    const txns = [
      txn({ categoryName: 'Food', amountMinor: 6000 }),
      txn({ categoryName: 'food', amountMinor: 5000 }),
      txn({ categoryName: 'Transport', amountMinor: 2000 }),
      txn({ type: 'income', categoryName: 'Salary', amountMinor: 99999 }), // ignored
    ];
    const budgets: BudgetLimit[] = [
      { userId: 'u1', categoryName: 'Food', monthlyLimitMinor: 10000, currency: 'INR', createdAt: '', updatedAt: '' },
    ];
    const spend = computeCategorySpend(txns, budgets);
    const food = spend.find((c) => normalizeCategoryName(c.categoryName) === 'food')!;
    expect(food.spentMinor).toBe(11000);
    expect(food.overBudget).toBe(true);
    const transport = spend.find((c) => c.categoryName === 'Transport')!;
    expect(transport.overBudget).toBe(false);
  });

  it('surfaces an unused budget at zero spend', () => {
    const budgets: BudgetLimit[] = [
      { userId: 'u1', categoryName: 'Rent', monthlyLimitMinor: 200000, currency: 'INR', createdAt: '', updatedAt: '' },
    ];
    const spend = computeCategorySpend([], budgets);
    expect(spend).toEqual([{ categoryName: 'Rent', spentMinor: 0, limitMinor: 200000, overBudget: false }]);
  });
});

function bill(over: Partial<RecurringPayment>): RecurringPayment {
  return {
    id: 'b',
    userId: 'u1',
    label: 'Rent',
    amountMinor: 200000,
    currency: 'INR',
    categoryName: 'Rent',
    interval: 'monthly',
    nextDueDate: '2026-06-01',
    active: true,
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

describe('nextOccurrenceOnOrAfter', () => {
  it('rolls a past monthly due date forward to the next future occurrence', () => {
    expect(nextOccurrenceOnOrAfter(bill({ nextDueDate: '2026-06-01' }), '2026-07-04T00:00:00Z')).toBe('2026-08-01');
  });

  it('leaves a future due date untouched', () => {
    expect(nextOccurrenceOnOrAfter(bill({ nextDueDate: '2026-07-10' }), '2026-07-04T00:00:00Z')).toBe('2026-07-10');
  });
});

describe('upcomingBillsWithin', () => {
  it('returns active bills due within the horizon, soonest first, and skips inactive', () => {
    const bills = [
      bill({ id: 'weekly', interval: 'weekly', nextDueDate: '2026-07-06', label: 'Gym' }),
      bill({ id: 'monthly', interval: 'monthly', nextDueDate: '2026-06-01', label: 'Rent' }), // rolls to 08-01, outside 14d
      bill({ id: 'inactive', active: false, nextDueDate: '2026-07-05' }),
    ];
    const upcoming = upcomingBillsWithin(bills, '2026-07-04T00:00:00Z', 14);
    expect(upcoming.map((b) => b.id)).toEqual(['weekly']);
    expect(upcoming[0]!.nextDueDate).toBe('2026-07-06');
  });
});
