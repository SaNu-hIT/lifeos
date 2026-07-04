// End-to-end functional test: drives the real Finance tool handlers through in-memory
// repositories (same style as skills/workout/test), proving the features work as a
// user would exercise them — not just the pure budget math in budget.test.ts.

import { describe, expect, it } from 'vitest';
import { runSkillContractTests } from '@lifeos/skill-sdk';
import type { DomainEvent, Tool, UnifiedContext } from '@lifeos/contracts';
import {
  createFinanceSkill,
  type BudgetLimit,
  type BudgetLimitRepositoryPort,
  type FinanceProfile,
  type FinanceProfileRepositoryPort,
  type FinanceSummary,
  type RecurringPayment,
  type RecurringPaymentRepositoryPort,
  type Transaction,
  type TransactionRepositoryPort,
} from '../src/index.js';

class InMemoryTransactions implements TransactionRepositoryPort {
  private rows = new Map<string, Transaction>();
  async addTransaction(t: Transaction): Promise<void> {
    this.rows.set(t.id, t);
  }
  async updateTransaction(
    userId: string,
    id: string,
    patch: Partial<Pick<Transaction, 'amountMinor' | 'categoryName' | 'description' | 'occurredAt' | 'type'>>,
  ): Promise<Transaction | undefined> {
    const t = this.rows.get(id);
    if (!t || t.userId !== userId) return undefined;
    const updated = { ...t, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
    this.rows.set(id, updated);
    return updated;
  }
  async deleteTransaction(userId: string, id: string): Promise<void> {
    const t = this.rows.get(id);
    if (t && t.userId === userId) this.rows.delete(id);
  }
  async getTransaction(userId: string, id: string): Promise<Transaction | undefined> {
    const t = this.rows.get(id);
    return t && t.userId === userId ? t : undefined;
  }
  async transactionsInRange(userId: string, fromIso: string, toIso: string): Promise<Transaction[]> {
    return [...this.rows.values()]
      .filter((t) => t.userId === userId && t.occurredAt >= fromIso && t.occurredAt <= toIso)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }
  async hasAny(userId: string): Promise<boolean> {
    return [...this.rows.values()].some((t) => t.userId === userId);
  }
}

class InMemoryRecurring implements RecurringPaymentRepositoryPort {
  private rows = new Map<string, RecurringPayment>();
  async addOrUpdate(p: RecurringPayment): Promise<void> {
    this.rows.set(p.id, p);
  }
  async listActive(userId: string): Promise<RecurringPayment[]> {
    return [...this.rows.values()].filter((p) => p.userId === userId && p.active);
  }
  async advanceNextDueDate(userId: string, id: string, newDate: string): Promise<void> {
    const p = this.rows.get(id);
    if (p && p.userId === userId) this.rows.set(id, { ...p, nextDueDate: newDate });
  }
}

class InMemoryBudgets implements BudgetLimitRepositoryPort {
  private rows = new Map<string, BudgetLimit>();
  private key(u: string, c: string): string {
    return `${u}::${c.toLowerCase()}`;
  }
  async upsert(b: BudgetLimit): Promise<void> {
    this.rows.set(this.key(b.userId, b.categoryName), b);
  }
  async listForUser(userId: string): Promise<BudgetLimit[]> {
    return [...this.rows.values()].filter((b) => b.userId === userId);
  }
}

class InMemoryProfiles implements FinanceProfileRepositoryPort {
  private rows = new Map<string, FinanceProfile>();
  async getProfile(userId: string): Promise<FinanceProfile | undefined> {
    return this.rows.get(userId);
  }
  async saveProfile(p: FinanceProfile): Promise<void> {
    this.rows.set(p.userId, p);
  }
}

function ctxFor(userId: string, nowIso = '2026-07-04T12:00:00.000Z'): UnifiedContext {
  return {
    user: { id: userId, locale: 'en-IN', timezone: 'Asia/Kolkata' },
    capabilities: ['finance.read', 'finance.track'],
    conversation: { id: 'c1', recentTurns: [] },
    memory: { facts: [], preferences: [], summaries: [] },
    settings: {},
    scope: 'finance',
    now: nowIso,
  };
}

function build() {
  const events: DomainEvent[] = [];
  let seq = 0;
  const manifest = createFinanceSkill({
    transactions: new InMemoryTransactions(),
    recurringPayments: new InMemoryRecurring(),
    budgets: new InMemoryBudgets(),
    profiles: new InMemoryProfiles(),
    newId: () => `id-${++seq}`,
    now: () => '2026-07-04T12:00:00.000Z',
    publish: async (e) => {
      events.push(e);
    },
  });
  return { manifest, events };
}

function tool(tools: Tool[], name: string): Tool {
  const t = tools.find((x) => x.name === name);
  if (!t) throw new Error(`no such tool: ${name}`);
  return t;
}

describe('@lifeos/skill-finance (functional)', () => {
  it('passes the skill contract', () => {
    runSkillContractTests(build().manifest);
  });

  it('logs income/expense and reports net + per-category spend in the summary', async () => {
    const { manifest } = build();
    const tools = manifest.tools;
    const ctx = ctxFor('u1');

    await tool(tools, 'finance.log_transaction').handler(ctx, {
      type: 'income',
      amountMinor: 5000000,
      categoryName: 'Salary',
    });
    await tool(tools, 'finance.log_transaction').handler(ctx, {
      type: 'expense',
      amountMinor: 120000,
      categoryName: 'Food',
    });
    await tool(tools, 'finance.log_transaction').handler(ctx, {
      type: 'expense',
      amountMinor: 30000,
      categoryName: 'food', // case-insensitive aggregation
    });

    const summary = (await tool(tools, 'finance.get_summary').handler(ctx, {})) as FinanceSummary;
    expect(summary.hasAnyHistory).toBe(true);
    expect(summary.totalIncomeMinor).toBe(5000000);
    expect(summary.totalExpenseMinor).toBe(150000);
    expect(summary.netMinor).toBe(4850000);
    const food = summary.byCategory.find((c) => c.categoryName.toLowerCase() === 'food')!;
    expect(food.spentMinor).toBe(150000);
  });

  it('flags over-budget spend and emits a budget_exceeded event', async () => {
    const { manifest, events } = build();
    const tools = manifest.tools;
    const ctx = ctxFor('u2');

    await tool(tools, 'finance.set_budget').handler(ctx, { categoryName: 'Food', monthlyLimitMinor: 100000 });
    await tool(tools, 'finance.log_transaction').handler(ctx, {
      type: 'expense',
      amountMinor: 150000,
      categoryName: 'Food',
    });

    const summary = (await tool(tools, 'finance.get_summary').handler(ctx, {})) as FinanceSummary;
    const food = summary.byCategory.find((c) => c.categoryName === 'Food')!;
    expect(food.overBudget).toBe(true);
    expect(food.limitMinor).toBe(100000);
    expect(events.some((e) => e.type === 'finance.budget_exceeded')).toBe(true);
  });

  it('surfaces an upcoming recurring bill in the summary', async () => {
    const { manifest } = build();
    const tools = manifest.tools;
    const ctx = ctxFor('u3');

    await tool(tools, 'finance.add_recurring_payment').handler(ctx, {
      label: 'Netflix',
      amountMinor: 64900,
      categoryName: 'Subscriptions',
      interval: 'monthly',
      nextDueDate: '2026-07-10',
    });

    const summary = (await tool(tools, 'finance.get_summary').handler(ctx, {})) as FinanceSummary;
    expect(summary.upcomingBills.map((b) => b.label)).toContain('Netflix');
  });

  it('edits and deletes a transaction', async () => {
    const { manifest } = build();
    const tools = manifest.tools;
    const ctx = ctxFor('u4');

    const { transactionId } = (await tool(tools, 'finance.log_transaction').handler(ctx, {
      type: 'expense',
      amountMinor: 5000,
      categoryName: 'Misc',
    })) as { transactionId: string };

    await tool(tools, 'finance.edit_transaction').handler(ctx, { transactionId, amountMinor: 7500 });
    let summary = (await tool(tools, 'finance.get_summary').handler(ctx, {})) as FinanceSummary;
    expect(summary.totalExpenseMinor).toBe(7500);

    await tool(tools, 'finance.delete_transaction').handler(ctx, { transactionId });
    summary = (await tool(tools, 'finance.get_summary').handler(ctx, {})) as FinanceSummary;
    expect(summary.totalExpenseMinor).toBe(0);
  });
});
