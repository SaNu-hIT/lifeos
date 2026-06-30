import type { BillingPort, BillingStatus } from '../../domain/ports/billing.port.js';
import type { SubscriptionRepository } from './subscription.repository.js';

/** DB-backed stub billing adapter. Replaced by a real PSP adapter later (KI: PSP deferred). */
export class DbBillingAdapter implements BillingPort {
  constructor(private readonly repo: SubscriptionRepository) {}

  async getStatus(userId: string): Promise<BillingStatus> {
    return this.repo.statusFor(userId);
  }
}
