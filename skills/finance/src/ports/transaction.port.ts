import type { Transaction } from '../domain/types.js';

export interface TransactionRepositoryPort {
  addTransaction(transaction: Transaction): Promise<void>;
  /** Partial update of a logged transaction; returns the updated row or undefined
   *  if no transaction with that id belongs to the user. */
  updateTransaction(
    userId: string,
    transactionId: string,
    patch: Partial<Pick<Transaction, 'amountMinor' | 'categoryName' | 'description' | 'occurredAt' | 'type'>>,
  ): Promise<Transaction | undefined>;
  deleteTransaction(userId: string, transactionId: string): Promise<void>;
  getTransaction(userId: string, transactionId: string): Promise<Transaction | undefined>;
  /** All transactions with occurredAt in [fromIso, toIso], newest first. */
  transactionsInRange(userId: string, fromIso: string, toIso: string): Promise<Transaction[]>;
  /** True if the user has ever logged any transaction (onboarding check). */
  hasAny(userId: string): Promise<boolean>;
}
