// Finance's Context Provider — a light existence/recency check only (cheap on every
// turn). The heavy structured breakdown lives behind the finance.get_summary tool
// call, not here, so context assembly stays fast even for heavy users.

import type { ContextProvider, ContextRequest, UnifiedContext } from '@lifeos/contracts';
import { computeCategorySpend, upcomingBillsWithin } from './domain/budget.js';
import type { TransactionRepositoryPort } from './ports/transaction.port.js';
import type { RecurringPaymentRepositoryPort } from './ports/recurring-payment.port.js';
import type { BudgetLimitRepositoryPort } from './ports/budget-limit.port.js';
import type { FinanceProfileRepositoryPort } from './ports/finance-profile.port.js';

export interface FinanceContextDeps {
  transactions: TransactionRepositoryPort;
  recurringPayments: RecurringPaymentRepositoryPort;
  budgets: BudgetLimitRepositoryPort;
  profiles: FinanceProfileRepositoryPort;
  now: () => string;
}

function monthStart(nowIso: string): string {
  const d = new Date(nowIso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export function createFinanceContextProvider(deps: FinanceContextDeps): ContextProvider {
  return {
    scope: 'finance',
    async contribute(request: ContextRequest): Promise<Partial<UnifiedContext>> {
      const nowIso = deps.now();
      const [hasAny, profile, monthTxns, budgets, bills] = await Promise.all([
        deps.transactions.hasAny(request.userId),
        deps.profiles.getProfile(request.userId),
        deps.transactions.transactionsInRange(request.userId, monthStart(nowIso), nowIso),
        deps.budgets.listForUser(request.userId),
        deps.recurringPayments.listActive(request.userId),
      ]);
      const overBudgetCount = computeCategorySpend(monthTxns, budgets).filter((c) => c.overBudget).length;
      const upcomingBillCount = upcomingBillsWithin(bills, nowIso, 7).length;

      return {
        settings: {
          finance: {
            onboardingIncomplete: !profile && !hasAny,
            hasAnyHistory: hasAny,
            overBudgetCategoryCount: overBudgetCount,
            billsDueSoonCount: upcomingBillCount,
          },
        },
      };
    },
  };
}
