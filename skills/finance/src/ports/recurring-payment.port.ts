import type { RecurringPayment } from '../domain/types.js';

export interface RecurringPaymentRepositoryPort {
  /** Insert or update a bill by id (upsert). */
  addOrUpdate(payment: RecurringPayment): Promise<void>;
  listActive(userId: string): Promise<RecurringPayment[]>;
  /** Persist a reactively-advanced nextDueDate (see domain/budget.ts). */
  advanceNextDueDate(userId: string, paymentId: string, newDate: string): Promise<void>;
}
