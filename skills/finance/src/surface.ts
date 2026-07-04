// Finance's surface contributions — feed, notifications, and a "Budget" home widget.
// Declarative; installed by the SkillHost. No platform imports (ADR-0001).

import type {
  ActivityProjection,
  DomainEvent,
  NotificationDeclaration,
  WidgetContribution,
} from '@lifeos/contracts';
import type { TransactionType } from './domain/types.js';
import { computeCategorySpend, upcomingBillsWithin } from './domain/budget.js';
import type { TransactionRepositoryPort } from './ports/transaction.port.js';
import type { RecurringPaymentRepositoryPort } from './ports/recurring-payment.port.js';
import type { BudgetLimitRepositoryPort } from './ports/budget-limit.port.js';

export const FINANCE_TRANSACTION_LOGGED = 'finance.transaction_logged';
export const FINANCE_BUDGET_EXCEEDED = 'finance.budget_exceeded';

export interface TransactionLoggedPayload {
  transactionId: string;
  type: TransactionType;
  amountMinor: number;
  currency: string;
  categoryName: string;
}

export interface BudgetExceededPayload {
  categoryName: string;
  spentMinor: number;
  limitMinor: number;
  currency: string;
}

export function createFinanceTransactionActivityProjection(): ActivityProjection {
  return {
    key: 'finance.transaction_logged',
    on: FINANCE_TRANSACTION_LOGGED,
    build: (event: DomainEvent) => {
      const p = event.payload as TransactionLoggedPayload;
      return {
        userId: event.userId!,
        kind: FINANCE_TRANSACTION_LOGGED,
        title: p.type === 'income' ? 'Income logged' : 'Expense logged',
        summary: `${p.categoryName} — ${p.currency} ${(p.amountMinor / 100).toFixed(2)}`,
        deepLink: `/finance`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export function createFinanceBudgetActivityProjection(): ActivityProjection {
  return {
    key: 'finance.budget_exceeded',
    on: FINANCE_BUDGET_EXCEEDED,
    build: (event: DomainEvent) => {
      const p = event.payload as BudgetExceededPayload;
      return {
        userId: event.userId!,
        kind: FINANCE_BUDGET_EXCEEDED,
        title: 'Over budget',
        summary: `${p.categoryName}: ${p.currency} ${(p.spentMinor / 100).toFixed(2)} of ${(p.limitMinor / 100).toFixed(2)}`,
        deepLink: `/finance/budgets`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export function createFinanceBudgetNotification(): NotificationDeclaration {
  return {
    key: 'finance.budget_exceeded',
    on: FINANCE_BUDGET_EXCEEDED,
    build: (event: DomainEvent) => {
      const p = event.payload as BudgetExceededPayload;
      return {
        userId: event.userId!,
        kind: FINANCE_BUDGET_EXCEEDED,
        title: 'Over budget',
        body: `You've spent ${p.currency} ${(p.spentMinor / 100).toFixed(2)} of your ${(p.limitMinor / 100).toFixed(2)} ${p.categoryName} budget.`,
        importance: 'normal',
        channels: ['in_app'],
        deepLink: `/finance/budgets`,
        dedupeKey: `finance.budget.${p.categoryName.toLowerCase()}.${event.occurredAt.slice(0, 7)}`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export interface FinanceWidgetDeps {
  transactions: TransactionRepositoryPort;
  budgets: BudgetLimitRepositoryPort;
  recurringPayments: RecurringPaymentRepositoryPort;
  /** Injected "now" — no hidden clocks (docs/02 §8). */
  now: () => string;
}

/** Home widget: "Budget" — this month's spend, over-budget categories, bills due
 *  soon. Hides entirely for brand-new users with zero history (same as Workout). */
export function createFinanceWidgets(deps: FinanceWidgetDeps): WidgetContribution[] {
  return [
    {
      key: 'finance.budget',
      title: 'Budget',
      requiredCapability: 'finance.read',
      priority: 30,
      build: async (ctx) => {
        const nowIso = deps.now();
        const d = new Date(nowIso);
        const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
        const [monthTxns, budgets, bills] = await Promise.all([
          deps.transactions.transactionsInRange(ctx.userId, start, nowIso),
          deps.budgets.listForUser(ctx.userId),
          deps.recurringPayments.listActive(ctx.userId),
        ]);
        if (monthTxns.length === 0 && budgets.length === 0 && bills.length === 0) return null;

        const byCategory = computeCategorySpend(monthTxns, budgets);
        const spentMinor = byCategory.reduce((sum, c) => sum + c.spentMinor, 0);
        const overBudgetCount = byCategory.filter((c) => c.overBudget).length;
        const billsDueSoon = upcomingBillsWithin(bills, nowIso, 7).length;

        return {
          urgency: overBudgetCount > 0 ? 0.7 : billsDueSoon > 0 ? 0.4 : 0.2,
          asOf: nowIso,
          props: {
            monthSpentMinor: spentMinor,
            overBudgetCategoryCount: overBudgetCount,
            billsDueSoonCount: billsDueSoon,
          },
        };
      },
    },
  ];
}
