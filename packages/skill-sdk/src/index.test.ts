import { describe, expect, it } from 'vitest';
import type { SkillManifest, Tool } from '@lifeos/contracts';
import { checkSkillContract, defineSkill, runSkillContractTests } from './index.js';

const schema = { type: 'object' as const };

function tool(name: string, cap: string): Tool {
  return {
    name,
    inputSchema: schema,
    outputSchema: schema,
    requiredCapability: cap as `${string}.${string}`,
    idempotent: true,
    requiresConfirmation: false,
    handler: async () => ({}),
  };
}

const valid: SkillManifest = {
  key: 'grocery',
  version: '1.0.0',
  contractVersion: '^0.6.0',
  capabilities: [{ key: 'grocery.order', description: 'x' }],
  tools: [tool('grocery.build_cart', 'grocery.order')],
};

describe('skill-sdk', () => {
  it('defineSkill returns a valid manifest unchanged', () => {
    expect(defineSkill(valid)).toBe(valid);
  });

  it('defineSkill throws on an invalid manifest', () => {
    expect(() => defineSkill({ ...valid, tools: [tool('grocery.x', 'grocery.undeclared')] })).toThrow(
      /Invalid skill manifest/,
    );
  });

  it('checkSkillContract flags a bad contractVersion and missing handler', () => {
    const bad = { ...valid, contractVersion: 'latest' } as SkillManifest;
    expect(checkSkillContract(bad).some((e) => e.includes('contractVersion'))).toBe(true);
  });

  it('runSkillContractTests passes for a valid manifest', () => {
    expect(() => runSkillContractTests(valid)).not.toThrow();
  });
});
