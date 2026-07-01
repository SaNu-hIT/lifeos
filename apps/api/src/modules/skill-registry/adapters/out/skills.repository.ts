import type { SkillDescriptor, SkillManifest } from '@lifeos/contracts';
import type { DatabasePort } from '../../../../shared/database/database.port.js';

/** Persists a serializable summary of each registered Skill + per-user enablement.
 *  Runs in service context (registration is a trusted system operation). */
export class SkillsRepository {
  constructor(private readonly db: DatabasePort) {}

  async upsert(manifest: SkillManifest, descriptor: SkillDescriptor): Promise<void> {
    const summary = {
      capabilities: descriptor.capabilities,
      tools: manifest.tools.map((t) => ({
        name: t.name,
        requiredCapability: t.requiredCapability,
        requiresConfirmation: t.requiresConfirmation,
      })),
    };
    await this.db.query(
      `insert into catalog.skills (key, version, contract_version, status, manifest)
       values ($1, $2, $3, $4, $5)
       on conflict (key) do update set
         version = excluded.version,
         contract_version = excluded.contract_version,
         status = excluded.status,
         manifest = excluded.manifest,
         updated_at = now()`,
      [manifest.key, manifest.version, manifest.contractVersion, descriptor.status, JSON.stringify(summary)],
    );
  }

  async setEnabled(userId: string, skillKey: string, enabled: boolean): Promise<void> {
    await this.db.query(
      `insert into catalog.user_skills (user_id, skill_key, enabled)
       values ($1, $2, $3)
       on conflict (user_id, skill_key) do update set enabled = excluded.enabled, updated_at = now()`,
      [userId, skillKey, enabled],
    );
  }
}
