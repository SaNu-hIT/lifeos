// Postgres-backed PlanCatalogPort. Reads billing.subscriptions/billing.plans/
// billing.plan_capabilities directly — the same tables SubscriptionRepository (an
// apps/api-internal class not exported through @lifeos/api) already owns. Read-only,
// service context, same pattern as GrantsRepository.activeFor.

import type { DatabasePort } from '@lifeos/api';
import type { CapabilityUnlock, PlanCatalogPort } from '@lifeos/skill-assistant';

export class PgPlanCatalogAdapter implements PlanCatalogPort {
  constructor(private readonly db: DatabasePort) {}

  async currentPlan(userId: string): Promise<string | undefined> {
    const r = await this.db.query<{ plan_key: string; status: string }>(
      'select plan_key, status from billing.subscriptions where user_id = $1',
      [userId],
    );
    const row = r.rows[0];
    return row && row.status === 'active' ? row.plan_key : undefined;
  }

  async plansGranting(capabilityKeys: string[]): Promise<CapabilityUnlock[]> {
    if (capabilityKeys.length === 0) return [];
    const r = await this.db.query<{ capability_key: string; plan_key: string; name: string }>(
      `select pc.capability_key, p.key as plan_key, p.name
         from billing.plan_capabilities pc
         join billing.plans p on p.key = pc.plan_key
        where pc.capability_key = any($1::text[])`,
      [capabilityKeys],
    );
    const byCap = new Map<string, { key: string; name: string }[]>();
    for (const row of r.rows) {
      const list = byCap.get(row.capability_key) ?? [];
      list.push({ key: row.plan_key, name: row.name });
      byCap.set(row.capability_key, list);
    }
    return capabilityKeys.map((capabilityKey) => ({
      capabilityKey,
      plans: byCap.get(capabilityKey) ?? [],
    }));
  }
}
