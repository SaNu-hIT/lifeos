import type { CapabilityKey } from '@lifeos/contracts';
import type { DatabasePort } from '../../../../shared/database/database.port.js';

/** Reads capability grants. Runs in service context (platform code resolving access
 *  on behalf of an authorization check), aggregating across all grant sources. */
export class GrantsRepository {
  constructor(private readonly db: DatabasePort) {}

  async activeFor(userId: string): Promise<CapabilityKey[]> {
    const result = await this.db.query<{ capability_key: string }>(
      `select distinct capability_key
         from billing.capability_grants
        where user_id = $1
          and (expires_at is null or expires_at > now())`,
      [userId],
    );
    return result.rows.map((r) => r.capability_key as CapabilityKey);
  }
}
