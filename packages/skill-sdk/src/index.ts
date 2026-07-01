// @lifeos/skill-sdk — the toolkit for building LifeOS Skills.
//
// A Skill is a self-contained plugin (docs/02 §10). This SDK provides the manifest
// helper and the contract-test kit every Skill verifies against. It depends only on
// @lifeos/contracts — never on the platform core (docs/adr/adr-0001-modular-monolith.md).

import { type SkillManifest, validateSkillManifest } from '@lifeos/contracts';

/** Additional contract-level checks beyond the shared manifest validation. */
function extraChecks(manifest: SkillManifest): string[] {
  const errors: string[] = [];
  if (!/^\^?\d+\.\d+\.\d+/.test(manifest.contractVersion)) {
    errors.push(`contractVersion must be a semver (range): ${manifest.contractVersion}`);
  }
  const seen = new Set<string>();
  for (const tool of manifest.tools) {
    if (seen.has(tool.name)) errors.push(`duplicate tool: ${tool.name}`);
    seen.add(tool.name);
    if (typeof tool.handler !== 'function') errors.push(`tool ${tool.name} has no handler`);
    if (typeof tool.inputSchema !== 'object') errors.push(`tool ${tool.name} has no inputSchema`);
    if (typeof tool.outputSchema !== 'object') errors.push(`tool ${tool.name} has no outputSchema`);
  }
  return errors;
}

/** Returns all contract problems with a manifest (empty = valid). */
export function checkSkillContract(manifest: SkillManifest): string[] {
  return [...validateSkillManifest(manifest), ...extraChecks(manifest)];
}

/**
 * Define a Skill. Validates the manifest at authoring time and returns it unchanged.
 * Throws if the manifest violates any contract invariant.
 */
export function defineSkill(manifest: SkillManifest): SkillManifest {
  const errors = checkSkillContract(manifest);
  if (errors.length > 0) {
    throw new Error(`Invalid skill manifest "${manifest.key}": ${errors.join('; ')}`);
  }
  return manifest;
}

/**
 * Contract-test kit. Call inside a Skill's test suite:
 *   it('passes the skill contract', () => runSkillContractTests(manifest));
 * Throws an aggregated error listing every problem (fails the test) if invalid.
 */
export function runSkillContractTests(manifest: SkillManifest): void {
  const errors = checkSkillContract(manifest);
  if (errors.length > 0) {
    throw new Error(`Skill contract failed for "${manifest.key}":\n- ${errors.join('\n- ')}`);
  }
}
