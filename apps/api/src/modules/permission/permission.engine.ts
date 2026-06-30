import type { CapabilityKey, PermissionDecision, PermissionPort } from '@lifeos/contracts';
import type { CachePort } from '../../shared/cache/cache.port.js';
import type { AuditLog } from '../../shared/audit/audit-log.js';
import type { GrantsRepository } from './adapters/out/grants.repository.js';

/** DI token for the concrete engine (exposes cache invalidation beyond PermissionPort). */
export const PERMISSION_ENGINE = Symbol('PERMISSION_ENGINE');

const CACHE_TTL_SECONDS = 60;
const cacheKey = (userId: string): string => `cap:${userId}`;

/**
 * Capability-based authorization (ADR-0006). Deny by default. The user's capability
 * set is cached (with invalidation on grant change), and denials are audited.
 */
export class PgPermissionEngine implements PermissionPort {
  constructor(
    private readonly grants: GrantsRepository,
    private readonly cache: CachePort,
    private readonly audit: AuditLog,
  ) {}

  async capabilitiesFor(userId: string): Promise<CapabilityKey[]> {
    const cached = await this.cache.get(cacheKey(userId));
    if (cached !== null) return JSON.parse(cached) as CapabilityKey[];
    const caps = await this.grants.activeFor(userId);
    await this.cache.set(cacheKey(userId), JSON.stringify(caps), CACHE_TTL_SECONDS);
    return caps;
  }

  async can(
    userId: string,
    capability: CapabilityKey,
    scope?: string,
  ): Promise<PermissionDecision> {
    const caps = await this.capabilitiesFor(userId);
    const allow = caps.includes(capability);
    if (!allow) {
      await this.audit.record({
        userId,
        actor: 'system',
        action: 'permission.check',
        resource: capability,
        decision: 'deny',
        metadata: scope ? { scope } : undefined,
      });
    }
    return allow ? { allow: true } : { allow: false, reason: `missing capability: ${capability}` };
  }

  /** Invalidate a user's cached capability set (called when grants change, phase-08). */
  async invalidate(userId: string): Promise<void> {
    await this.cache.del(cacheKey(userId));
  }
}
