// Contract-level naming invariants (docs/03_LifeOS_Engineering_Handbook.md §4).
// Enforced here so every Skill/Tool/Connector across the platform is named
// consistently and validated the same way.

import type { SkillManifest } from './skill/manifest.js';

/** Tool name: `<skill>.<snake_verb_noun>`, e.g. `grocery.build_cart`. */
const TOOL_NAME = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
/** Capability key: `<domain>.<action>`, e.g. `grocery.order`. */
const CAPABILITY_KEY = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
/** Event type: `<context>.<thing>_<pastTense>`, e.g. `grocery.order_placed`. */
const EVENT_TYPE = /^[a-z][a-z0-9_]*\.[a-z0-9_]+$/;

export function isValidToolName(name: string): boolean {
  return TOOL_NAME.test(name);
}

export function isValidCapabilityKey(key: string): boolean {
  return CAPABILITY_KEY.test(key);
}

export function isValidEventType(type: string): boolean {
  return EVENT_TYPE.test(type);
}

/**
 * Validates a Skill manifest against contract-level invariants. Returns a list of
 * human-readable problems (empty = valid). The Skill Registry (phase-10) refuses
 * any manifest that produces errors here.
 */
export function validateSkillManifest(manifest: SkillManifest): string[] {
  const errors: string[] = [];

  if (!manifest.key || !/^[a-z][a-z0-9_]*$/.test(manifest.key)) {
    errors.push(`invalid skill key: ${JSON.stringify(manifest.key)}`);
  }
  if (!manifest.version) errors.push('manifest.version is required');
  if (!manifest.contractVersion) errors.push('manifest.contractVersion is required');

  for (const capability of manifest.capabilities) {
    if (!isValidCapabilityKey(capability.key)) {
      errors.push(`invalid capability key: ${capability.key}`);
    }
  }

  const declared = new Set(manifest.capabilities.map((c) => c.key));
  for (const tool of manifest.tools) {
    if (!isValidToolName(tool.name)) {
      errors.push(`invalid tool name: ${tool.name}`);
    }
    if (!tool.name.startsWith(`${manifest.key}.`)) {
      errors.push(`tool ${tool.name} must be namespaced under skill "${manifest.key}"`);
    }
    if (!declared.has(tool.requiredCapability)) {
      errors.push(`tool ${tool.name} requires undeclared capability ${tool.requiredCapability}`);
    }
  }

  for (const notification of manifest.notifications ?? []) {
    if (!isValidEventType(notification.on)) {
      errors.push(`notification ${notification.key} has invalid trigger event: ${notification.on}`);
    }
  }

  return errors;
}
