import { gte, major, minVersion } from 'semver';
import {
  CONTRACTS_VERSION,
  type SkillDescriptor,
  type SkillManifest,
  type SkillRegistryPort,
  type ToolRegistryPort,
} from '@lifeos/contracts';
import type { SkillsRepository } from './adapters/out/skills.repository.js';

/**
 * Registers Skills FROM MANIFESTS. The core never imports a Skill
 * (docs/adr/adr-0001-modular-monolith.md). On register it checks contract-version
 * compatibility, forwards the Skill's tools to the Tool Registry, and persists a
 * summary. A Skill targeting an incompatible platform contract is refused.
 */
export class SkillRegistry implements SkillRegistryPort {
  private readonly skills = new Map<string, SkillDescriptor>();

  constructor(
    private readonly tools: ToolRegistryPort,
    private readonly repo: SkillsRepository,
  ) {}

  async register(manifest: SkillManifest): Promise<void> {
    if (this.skills.has(manifest.key)) {
      throw new Error(`skill already registered: ${manifest.key}`);
    }
    // Compatibility policy: the contract surface is ADDITIVE within a major line
    // (the export-surface guard forbids removals; breaking changes bump the major +
    // an ADR — docs/08). So a Skill is compatible when it targets the same major and
    // the platform is at or above the Skill's minimum. This lets additive minor bumps
    // ship without re-versioning every Skill.
    const floor = minVersion(manifest.contractVersion);
    if (!floor || major(CONTRACTS_VERSION) !== major(floor) || !gte(CONTRACTS_VERSION, floor)) {
      throw new Error(
        `skill "${manifest.key}" targets contract ${manifest.contractVersion}, ` +
          `incompatible with platform ${CONTRACTS_VERSION}`,
      );
    }

    // Forward the Skill's tools to the Tool Registry (phase-09).
    for (const tool of manifest.tools) {
      this.tools.register(tool);
    }

    const descriptor: SkillDescriptor = {
      key: manifest.key,
      version: manifest.version,
      title: manifest.title,
      description: manifest.description,
      contractVersion: manifest.contractVersion,
      status: 'registered',
      toolNames: manifest.tools.map((t) => t.name),
      capabilities: manifest.capabilities.map((c) => c.key),
    };
    this.skills.set(manifest.key, descriptor);
    await this.repo.upsert(manifest, descriptor);
  }

  list(): SkillDescriptor[] {
    return [...this.skills.values()];
  }

  get(key: string): SkillDescriptor | undefined {
    return this.skills.get(key);
  }

  async setEnabled(userId: string, key: string, enabled: boolean): Promise<void> {
    if (!this.skills.has(key)) throw new Error(`unknown skill: ${key}`);
    await this.repo.setEnabled(userId, key, enabled);
  }
}
