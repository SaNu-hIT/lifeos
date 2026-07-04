import { Module } from '@nestjs/common';
import { DATABASE, type DatabasePort } from '../../shared/database/database.port.js';
import { BILLING_PORT } from './domain/ports/billing.port.js';
import {
  PLAN_CAPABILITY_LOOKUP,
  type PlanCapabilityLookupPort,
} from './domain/ports/plan-capability-lookup.port.js';
import { SubscriptionRepository } from './adapters/out/subscription.repository.js';
import { DbBillingAdapter } from './adapters/out/db-billing.adapter.js';
import { SubscriptionService } from './application/subscription.service.js';

@Module({
  providers: [
    {
      provide: SubscriptionRepository,
      useFactory: (db: DatabasePort) => new SubscriptionRepository(db),
      inject: [DATABASE],
    },
    SubscriptionService,
    {
      provide: BILLING_PORT,
      useFactory: (repo: SubscriptionRepository) => new DbBillingAdapter(repo),
      inject: [SubscriptionRepository],
    },
    {
      provide: PLAN_CAPABILITY_LOOKUP,
      useFactory: (repo: SubscriptionRepository): PlanCapabilityLookupPort => ({
        plansGranting: (capabilityKey) => repo.plansGranting(capabilityKey),
      }),
      inject: [SubscriptionRepository],
    },
  ],
  exports: [SubscriptionService, BILLING_PORT, PLAN_CAPABILITY_LOOKUP],
})
export class SubscriptionModule {}
