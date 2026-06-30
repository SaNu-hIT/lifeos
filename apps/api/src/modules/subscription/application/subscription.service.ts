import { Inject, Injectable } from '@nestjs/common';
import type { CapabilityKey } from '@lifeos/contracts';
import { PERMISSION_ENGINE, type PgPermissionEngine } from '../../permission/permission.engine.js';
import { SubscriptionRepository } from '../adapters/out/subscription.repository.js';

/**
 * Turns billing state into capability grants (ADR-0006). Subscriptions reference
 * capabilities, never Skills. Any grant change invalidates the permission cache so
 * authorization reflects it immediately.
 */
@Injectable()
export class SubscriptionService {
  constructor(
    private readonly repo: SubscriptionRepository,
    @Inject(PERMISSION_ENGINE) private readonly permissions: PgPermissionEngine,
  ) {}

  async changePlan(userId: string, planKey: string): Promise<void> {
    const capabilities = await this.repo.capabilitiesForPlan(planKey);
    await this.repo.setSubscriptionAndGrants(userId, planKey, capabilities);
    await this.permissions.invalidate(userId);
  }

  async startTrial(
    userId: string,
    capabilities: CapabilityKey[],
    expiresAt: string,
  ): Promise<void> {
    await this.repo.addTrialGrants(userId, capabilities, expiresAt);
    await this.permissions.invalidate(userId);
  }
}
