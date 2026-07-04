// Finance's domain model. Like Workout and Wellness, this is pure first-party
// persistence — no external connector. Money is stored as integer minor units
// (amountMinor, e.g. paise/cents) to avoid float rounding, mirroring Grocery's
// priceMinor. Category names are freeform text (with a normalized companion key),
// so there is no hard category catalog — same approach as Workout's exercise names.

export type TransactionType = 'expense' | 'income';

export type RecurrenceInterval = 'weekly' | 'monthly' | 'yearly';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  /** Integer minor units (e.g. cents/paise). Always >= 0; direction is `type`. */
  amountMinor: number;
  currency: string;
  categoryName: string;
  /** ISO date-time the money moved (yyyy-mm-ddThh:mm:ssZ). */
  occurredAt: string;
  description?: string;
  createdAt: string;
}

/** A recurring bill/subscription. Its nextDueDate is advanced reactively at read
 *  time (see domain/budget.ts) — the platform has no scheduler (v1 limitation). */
export interface RecurringPayment {
  id: string;
  userId: string;
  label: string;
  amountMinor: number;
  currency: string;
  categoryName: string;
  interval: RecurrenceInterval;
  /** ISO date (yyyy-mm-dd) of the next occurrence. */
  nextDueDate: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A per-category monthly spend cap. Keyed by (userId, categoryName). */
export interface BudgetLimit {
  userId: string;
  categoryName: string;
  monthlyLimitMinor: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceProfile {
  userId: string;
  currency: string;
  monthlyIncomeMinor?: number;
  savingsGoalMinor?: number;
  createdAt: string;
  updatedAt: string;
}

// ── Shapes fed to the LLM for AI-composed insights ──────────────────────────────
// DATA only — the Skill never authors budgeting advice itself (same contract as
// Workout's WorkoutHistorySummary and Wellness's WellnessHistorySummary).

export interface CategorySpend {
  categoryName: string;
  spentMinor: number;
  limitMinor?: number;
  overBudget: boolean;
}

export interface FinanceSummary {
  /** false triggers onboarding — ask about income/currency before advising. */
  hasAnyHistory: boolean;
  hasProfile: boolean;
  currency: string;
  periodStart: string;
  periodEnd: string;
  totalIncomeMinor: number;
  totalExpenseMinor: number;
  netMinor: number;
  byCategory: CategorySpend[];
  upcomingBills: RecurringPayment[];
  profile?: FinanceProfile;
}
