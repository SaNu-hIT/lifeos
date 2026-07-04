// @lifeos/skill-finance — Skill #5. Same SDK path as Grocery/Calendar/Workout/
// Wellness, a fifth unrelated domain proving the platform generalises (ADR-0001).
// Like Workout/Wellness it has no external connector — pure first-party persistence,
// so there is no ProviderPort or provider-contract.ts.

import { type SkillManifest } from '@lifeos/contracts';
import { defineSkill } from '@lifeos/skill-sdk';
import { createFinanceTools, type FinanceToolDeps } from './tools.js';
import { createFinanceContextProvider } from './context.js';
import {
  createFinanceTransactionActivityProjection,
  createFinanceBudgetActivityProjection,
  createFinanceBudgetNotification,
  createFinanceWidgets,
} from './surface.js';

export interface FinanceSkillDeps extends FinanceToolDeps {
  /** Injected clock for context/widgets — no hidden time (docs/02 §8). */
  now: () => string;
}

export function createFinanceSkill(deps: FinanceSkillDeps): SkillManifest {
  return defineSkill({
    key: 'finance',
    version: '1.0.0',
    title: 'Finance',
    description:
      'Track expenses and income, manage recurring bills, set per-category budgets, ' +
      'and get an AI-composed read on your spending from your real transaction history.',
    contractVersion: '^0.9.0',
    capabilities: [
      { key: 'finance.read', description: 'View transactions, budgets, bills, and summaries' },
      { key: 'finance.track', description: 'Log transactions, manage budgets and recurring bills' },
    ],
    tools: createFinanceTools(deps),
    contextProviders: [
      createFinanceContextProvider({
        transactions: deps.transactions,
        recurringPayments: deps.recurringPayments,
        budgets: deps.budgets,
        profiles: deps.profiles,
        now: deps.now,
      }),
    ],
    activityProjections: [
      createFinanceTransactionActivityProjection(),
      createFinanceBudgetActivityProjection(),
    ],
    notifications: [createFinanceBudgetNotification()],
    widgets: createFinanceWidgets({
      transactions: deps.transactions,
      budgets: deps.budgets,
      recurringPayments: deps.recurringPayments,
      now: deps.now,
    }),
  });
}

export * from './domain/types.js';
export * from './domain/budget.js';
export type { TransactionRepositoryPort } from './ports/transaction.port.js';
export type { RecurringPaymentRepositoryPort } from './ports/recurring-payment.port.js';
export type { BudgetLimitRepositoryPort } from './ports/budget-limit.port.js';
export type { FinanceProfileRepositoryPort } from './ports/finance-profile.port.js';
export { createFinanceTools, type FinanceToolDeps } from './tools.js';
export { createFinanceContextProvider, type FinanceContextDeps } from './context.js';
export {
  FINANCE_TRANSACTION_LOGGED,
  FINANCE_BUDGET_EXCEEDED,
  createFinanceTransactionActivityProjection,
  createFinanceBudgetActivityProjection,
  createFinanceBudgetNotification,
  createFinanceWidgets,
  type TransactionLoggedPayload,
  type BudgetExceededPayload,
  type FinanceWidgetDeps,
} from './surface.js';
