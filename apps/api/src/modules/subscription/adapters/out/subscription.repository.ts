import type { DatabasePort } from '../../../../shared/database/database.port.js';

/** Persistence for plans, the plan→capability map, subscriptions, and the grants
 *  materialized from them. Runs in service context (trusted billing operations). */
export class SubscriptionRepository {
  constructor(private readonly db: DatabasePort) {}

  async capabilitiesForPlan(planKey: string): Promise<string[]> {
    const result = await this.db.query<{ capability_key: string }>(
      'select capability_key from billing.plan_capabilities where plan_key = $1',
      [planKey],
    );
    return result.rows.map((r) => r.capability_key);
  }

  /** Upsert the subscription and replace its materialized capability grants atomically. */
  async setSubscriptionAndGrants(
    userId: string,
    planKey: string,
    capabilities: string[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.query(
        `insert into billing.subscriptions (user_id, plan_key) values ($1, $2)
         on conflict (user_id) do update set plan_key = excluded.plan_key, status = 'active', updated_at = now()`,
        [userId, planKey],
      );
      await tx.query(
        "delete from billing.capability_grants where user_id = $1 and source = 'subscription'",
        [userId],
      );
      for (const capability of capabilities) {
        await tx.query(
          `insert into billing.capability_grants (user_id, capability_key, source)
           values ($1, $2, 'subscription') on conflict do nothing`,
          [userId, capability],
        );
      }
    });
  }

  async addTrialGrants(
    userId: string,
    capabilities: string[],
    expiresAt: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const capability of capabilities) {
        await tx.query(
          `insert into billing.capability_grants (user_id, capability_key, source, expires_at)
           values ($1, $2, 'trial', $3)
           on conflict (user_id, capability_key, source) do update set expires_at = excluded.expires_at`,
          [userId, capability, expiresAt],
        );
      }
    });
  }

  async statusFor(userId: string): Promise<{ active: boolean; planKey?: string }> {
    const result = await this.db.query<{ plan_key: string; status: string }>(
      'select plan_key, status from billing.subscriptions where user_id = $1',
      [userId],
    );
    const row = result.rows[0];
    return row ? { active: row.status === 'active', planKey: row.plan_key } : { active: false };
  }
}
