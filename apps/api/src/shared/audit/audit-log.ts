import type { DatabasePort } from '../database/database.port.js';

/** DI token for the AuditLog. */
export const AUDIT_LOG = Symbol('AUDIT_LOG');

export interface AuditEntry {
  userId?: string;
  actor: string; // 'user' | 'system' | 'skill:grocery' ...
  action: string; // 'permission.check', 'tool.execute', ...
  resource?: string;
  decision?: string; // 'allow' | 'deny'
  metadata?: unknown; // non-sensitive only (docs/11 §7)
}

/** Writes immutable audit records (docs/11_SECURITY_GUIDE.md §7). */
export class AuditLog {
  constructor(private readonly db: DatabasePort) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.db.query(
      `insert into platform.audit_logs (user_id, actor, action, resource, decision, metadata)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        entry.userId ?? null,
        entry.actor,
        entry.action,
        entry.resource ?? null,
        entry.decision ?? null,
        entry.metadata === undefined ? null : JSON.stringify(entry.metadata),
      ],
    );
  }
}
