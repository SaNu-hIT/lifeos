// Finance tools — the units the Planner can call. Handlers close over injected
// ports only (ADR-0004: logic lives here, the AI never touches the DB directly).
// `get_summary` is deliberately data-only: it hands the LLM clean structured
// finances so IT composes the reply — no rule-based budgeting advice lives here.

import type { DomainEvent, Tool, UnifiedContext } from '@lifeos/contracts';
import type {
  BudgetLimit,
  FinanceProfile,
  FinanceSummary,
  RecurrenceInterval,
  RecurringPayment,
  Transaction,
  TransactionType,
} from './domain/types.js';
import { computeCategorySpend, netForPeriod, upcomingBillsWithin } from './domain/budget.js';
import type { TransactionRepositoryPort } from './ports/transaction.port.js';
import type { RecurringPaymentRepositoryPort } from './ports/recurring-payment.port.js';
import type { BudgetLimitRepositoryPort } from './ports/budget-limit.port.js';
import type { FinanceProfileRepositoryPort } from './ports/finance-profile.port.js';
import {
  FINANCE_BUDGET_EXCEEDED,
  FINANCE_TRANSACTION_LOGGED,
  type BudgetExceededPayload,
  type TransactionLoggedPayload,
} from './surface.js';

const DEFAULT_CURRENCY = 'INR';
const UPCOMING_BILL_HORIZON_DAYS = 14;

export interface FinanceToolDeps {
  transactions: TransactionRepositoryPort;
  recurringPayments: RecurringPaymentRepositoryPort;
  budgets: BudgetLimitRepositoryPort;
  profiles: FinanceProfileRepositoryPort;
  newId: () => string;
  /** Injected clock — no hidden "now" (docs/02 §8). Defaults to real time. */
  now?: () => string;
  publish?: (event: DomainEvent) => Promise<void>;
}

interface LogTransactionArgs {
  type: TransactionType;
  amountMinor: number;
  categoryName: string;
  description?: string;
  occurredAt?: string;
}
interface EditTransactionArgs {
  transactionId: string;
  amountMinor?: number;
  categoryName?: string;
  description?: string;
  occurredAt?: string;
  type?: TransactionType;
}
interface DeleteTransactionArgs {
  transactionId: string;
}
interface AddRecurringPaymentArgs {
  label: string;
  amountMinor: number;
  categoryName: string;
  interval: RecurrenceInterval;
  nextDueDate: string;
  currency?: string;
}
interface SetBudgetArgs {
  categoryName: string;
  monthlyLimitMinor: number;
  currency?: string;
}
interface GetSummaryArgs {
  periodStart?: string;
  periodEnd?: string;
}

/** First and last ISO date-time of the calendar month containing `nowIso`. */
function currentMonthBounds(nowIso: string): { start: string; end: string } {
  const d = new Date(nowIso);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function createFinanceTools(deps: FinanceToolDeps): Tool[] {
  const { newId } = deps;
  const now = () => deps.now?.() ?? new Date().toISOString();

  async function resolveCurrency(userId: string, explicit?: string): Promise<string> {
    if (explicit) return explicit;
    const profile = await deps.profiles.getProfile(userId);
    return profile?.currency ?? DEFAULT_CURRENCY;
  }

  const logTransaction: Tool<LogTransactionArgs, { transactionId: string }> = {
    name: 'finance.log_transaction',
    description:
      'Record one expense or income. amountMinor is a positive integer in minor ' +
      'currency units (e.g. cents/paise: ₹250.00 → 25000); direction is set by `type`. ' +
      'Category names are freeform. occurredAt defaults to now.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['expense', 'income'] },
        amountMinor: { type: 'integer' },
        categoryName: { type: 'string' },
        description: { type: 'string' },
        occurredAt: { type: 'string' },
      },
      required: ['type', 'amountMinor', 'categoryName'],
    },
    outputSchema: {
      type: 'object',
      properties: { transactionId: { type: 'string' } },
      required: ['transactionId'],
    },
    requiredCapability: 'finance.track',
    idempotent: false,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: LogTransactionArgs) => {
      const currency = await resolveCurrency(ctx.user.id);
      const occurredAt = args.occurredAt ?? now();
      const transaction: Transaction = {
        id: newId(),
        userId: ctx.user.id,
        type: args.type,
        amountMinor: Math.max(0, Math.round(args.amountMinor)),
        currency,
        categoryName: args.categoryName,
        occurredAt,
        description: args.description,
        createdAt: now(),
      };
      await deps.transactions.addTransaction(transaction);

      if (deps.publish) {
        const payload: TransactionLoggedPayload = {
          transactionId: transaction.id,
          type: transaction.type,
          amountMinor: transaction.amountMinor,
          currency,
          categoryName: transaction.categoryName,
        };
        await deps.publish({
          eventId: newId(),
          type: FINANCE_TRANSACTION_LOGGED,
          userId: ctx.user.id,
          occurredAt: transaction.createdAt,
          payload,
        });

        // If this expense pushed a budgeted category over its cap, surface it.
        if (transaction.type === 'expense') {
          const { start, end } = currentMonthBounds(now());
          const [monthTxns, budgets] = await Promise.all([
            deps.transactions.transactionsInRange(ctx.user.id, start, end),
            deps.budgets.listForUser(ctx.user.id),
          ]);
          const overspent = computeCategorySpend(monthTxns, budgets).find(
            (c) => c.overBudget && c.categoryName.toLowerCase() === transaction.categoryName.toLowerCase(),
          );
          if (overspent) {
            const payloadOver: BudgetExceededPayload = {
              categoryName: overspent.categoryName,
              spentMinor: overspent.spentMinor,
              limitMinor: overspent.limitMinor!,
              currency,
            };
            await deps.publish({
              eventId: newId(),
              type: FINANCE_BUDGET_EXCEEDED,
              userId: ctx.user.id,
              occurredAt: transaction.createdAt,
              payload: payloadOver,
            });
          }
        }
      }

      return { transactionId: transaction.id };
    },
  };

  const editTransaction: Tool<EditTransactionArgs, { transactionId: string }> = {
    name: 'finance.edit_transaction',
    description: "Correct a previously logged transaction's amount, category, type, description, or date.",
    inputSchema: {
      type: 'object',
      properties: {
        transactionId: { type: 'string' },
        amountMinor: { type: 'integer' },
        categoryName: { type: 'string' },
        description: { type: 'string' },
        occurredAt: { type: 'string' },
        type: { type: 'string', enum: ['expense', 'income'] },
      },
      required: ['transactionId'],
    },
    outputSchema: {
      type: 'object',
      properties: { transactionId: { type: 'string' } },
      required: ['transactionId'],
    },
    requiredCapability: 'finance.track',
    idempotent: false,
    requiresConfirmation: true,
    handler: async (ctx: UnifiedContext, args: EditTransactionArgs) => {
      const updated = await deps.transactions.updateTransaction(ctx.user.id, args.transactionId, {
        amountMinor: args.amountMinor != null ? Math.max(0, Math.round(args.amountMinor)) : undefined,
        categoryName: args.categoryName,
        description: args.description,
        occurredAt: args.occurredAt,
        type: args.type,
      });
      if (!updated) throw new Error('transaction not found');
      return { transactionId: updated.id };
    },
  };

  const deleteTransaction: Tool<DeleteTransactionArgs, { deleted: true }> = {
    name: 'finance.delete_transaction',
    description: 'Remove a mistakenly logged transaction.',
    inputSchema: {
      type: 'object',
      properties: { transactionId: { type: 'string' } },
      required: ['transactionId'],
    },
    outputSchema: { type: 'object', properties: { deleted: { type: 'boolean' } }, required: ['deleted'] },
    requiredCapability: 'finance.track',
    idempotent: false,
    requiresConfirmation: true,
    handler: async (ctx: UnifiedContext, args: DeleteTransactionArgs) => {
      await deps.transactions.deleteTransaction(ctx.user.id, args.transactionId);
      return { deleted: true };
    },
  };

  const addRecurringPayment: Tool<AddRecurringPaymentArgs, { paymentId: string }> = {
    name: 'finance.add_recurring_payment',
    description:
      'Add a recurring bill/subscription (rent, streaming, EMI). interval is weekly, ' +
      'monthly, or yearly; nextDueDate is the next occurrence (yyyy-mm-dd). Due dates ' +
      'roll forward automatically when read — there is no separate charge event.',
    inputSchema: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        amountMinor: { type: 'integer' },
        categoryName: { type: 'string' },
        interval: { type: 'string', enum: ['weekly', 'monthly', 'yearly'] },
        nextDueDate: { type: 'string' },
        currency: { type: 'string' },
      },
      required: ['label', 'amountMinor', 'categoryName', 'interval', 'nextDueDate'],
    },
    outputSchema: {
      type: 'object',
      properties: { paymentId: { type: 'string' } },
      required: ['paymentId'],
    },
    requiredCapability: 'finance.track',
    idempotent: false,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: AddRecurringPaymentArgs) => {
      const currency = await resolveCurrency(ctx.user.id, args.currency);
      const payment: RecurringPayment = {
        id: newId(),
        userId: ctx.user.id,
        label: args.label,
        amountMinor: Math.max(0, Math.round(args.amountMinor)),
        currency,
        categoryName: args.categoryName,
        interval: args.interval,
        nextDueDate: args.nextDueDate,
        active: true,
        createdAt: now(),
        updatedAt: now(),
      };
      await deps.recurringPayments.addOrUpdate(payment);
      return { paymentId: payment.id };
    },
  };

  const setBudget: Tool<SetBudgetArgs, { saved: true }> = {
    name: 'finance.set_budget',
    description:
      'Set or update a monthly spending cap for a category (upsert by category). ' +
      'monthlyLimitMinor is in minor units.',
    inputSchema: {
      type: 'object',
      properties: {
        categoryName: { type: 'string' },
        monthlyLimitMinor: { type: 'integer' },
        currency: { type: 'string' },
      },
      required: ['categoryName', 'monthlyLimitMinor'],
    },
    outputSchema: { type: 'object', properties: { saved: { type: 'boolean' } }, required: ['saved'] },
    requiredCapability: 'finance.track',
    idempotent: false,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: SetBudgetArgs) => {
      const currency = await resolveCurrency(ctx.user.id, args.currency);
      const budget: BudgetLimit = {
        userId: ctx.user.id,
        categoryName: args.categoryName,
        monthlyLimitMinor: Math.max(0, Math.round(args.monthlyLimitMinor)),
        currency,
        createdAt: now(),
        updatedAt: now(),
      };
      await deps.budgets.upsert(budget);
      return { saved: true };
    },
  };

  const getSummary: Tool<GetSummaryArgs, FinanceSummary> = {
    name: 'finance.get_summary',
    description:
      'Fetch a structured finance summary for a period (income, expense, net, ' +
      'per-category spend vs. budget, and upcoming bills). Defaults to the current ' +
      'calendar month. Returns DATA ONLY — it does not itself give budgeting advice; ' +
      'compose the reply using this data. If hasAnyHistory and hasProfile are both ' +
      'false, ask the user about their currency, monthly income, and savings goal ' +
      'first (finance.log_transaction / a profile) instead of advising blind.',
    inputSchema: {
      type: 'object',
      properties: { periodStart: { type: 'string' }, periodEnd: { type: 'string' } },
    },
    outputSchema: { type: 'object' },
    requiredCapability: 'finance.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: GetSummaryArgs) => {
      const nowIso = now();
      const bounds = currentMonthBounds(nowIso);
      const periodStart = args.periodStart ?? bounds.start;
      const periodEnd = args.periodEnd ?? bounds.end;

      const [profile, transactions, budgets, bills, hasAny] = await Promise.all([
        deps.profiles.getProfile(ctx.user.id),
        deps.transactions.transactionsInRange(ctx.user.id, periodStart, periodEnd),
        deps.budgets.listForUser(ctx.user.id),
        deps.recurringPayments.listActive(ctx.user.id),
        deps.transactions.hasAny(ctx.user.id),
      ]);

      const { totalIncomeMinor, totalExpenseMinor, netMinor } = netForPeriod(transactions);

      return {
        hasAnyHistory: hasAny,
        hasProfile: profile != null,
        currency: profile?.currency ?? DEFAULT_CURRENCY,
        periodStart,
        periodEnd,
        totalIncomeMinor,
        totalExpenseMinor,
        netMinor,
        byCategory: computeCategorySpend(transactions, budgets),
        upcomingBills: upcomingBillsWithin(bills, nowIso, UPCOMING_BILL_HORIZON_DAYS),
        profile,
      };
    },
  };

  return [logTransaction, editTransaction, deleteTransaction, addRecurringPayment, setBudget, getSummary];
}

export type { FinanceProfile };
