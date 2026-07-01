// The Skill Registry — the core registers Skills from manifests and never imports
// them (docs/02 §10, docs/adr/adr-0001-modular-monolith.md).

import type { SkillManifest } from './manifest.js';

/** DI token for the SkillRegistryPort. */
export const SKILL_REGISTRY = Symbol('SKILL_REGISTRY');

export type SkillStatus = 'registered' | 'enabled' | 'disabled';

/** A serializable view of a registered Skill (no handlers). */
export interface SkillDescriptor {
  key: string;
  version: string;
  contractVersion: string;
  status: SkillStatus;
  toolNames: string[];
  capabilities: string[];
}

export interface SkillRegistryPort {
  /** Validate, check contract compatibility, forward tools, and persist. */
  register(manifest: SkillManifest): Promise<void>;
  list(): SkillDescriptor[];
  get(key: string): SkillDescriptor | undefined;
  /** Per-user enable/disable (capability-aware surfaces honor this). */
  setEnabled(userId: string, key: string, enabled: boolean): Promise<void>;
}
