import { describe, expect, it } from 'vitest';
import {
  isValidCapabilityKey,
  isValidEventType,
  isValidToolName,
  validateSkillManifest,
} from './naming.js';
import type { SkillManifest } from './skill/manifest.js';
import type { Tool } from './tool/tool.js';

const schema = { type: 'object' as const };

function tool(name: string, requiredCapability: string): Tool {
  return {
    name,
    inputSchema: schema,
    outputSchema: schema,
    requiredCapability: requiredCapability as `${string}.${string}`,
    idempotent: true,
    requiresConfirmation: false,
    handler: async () => ({}),
  };
}

describe('naming invariants', () => {
  it('accepts valid tool names and rejects invalid ones', () => {
    expect(isValidToolName('grocery.build_cart')).toBe(true);
    expect(isValidToolName('Grocery.BuildCart')).toBe(false);
    expect(isValidToolName('grocery')).toBe(false);
    expect(isValidToolName('grocery.')).toBe(false);
  });

  it('validates capability keys and event types', () => {
    expect(isValidCapabilityKey('grocery.order')).toBe(true);
    expect(isValidCapabilityKey('grocery')).toBe(false);
    expect(isValidEventType('grocery.order_placed')).toBe(true);
    expect(isValidEventType('OrderPlaced')).toBe(false);
  });
});

describe('validateSkillManifest', () => {
  const valid: SkillManifest = {
    key: 'grocery',
    version: '1.0.0',
    contractVersion: '^0.2.0',
    capabilities: [{ key: 'grocery.order', description: 'Place grocery orders' }],
    tools: [tool('grocery.build_cart', 'grocery.order')],
  };

  it('accepts a valid manifest', () => {
    expect(validateSkillManifest(valid)).toEqual([]);
  });

  it('rejects a tool requiring an undeclared capability', () => {
    const errors = validateSkillManifest({
      ...valid,
      tools: [tool('grocery.build_cart', 'grocery.admin')],
    });
    expect(errors.some((e) => e.includes('undeclared capability'))).toBe(true);
  });

  it('rejects a tool not namespaced under the skill', () => {
    const errors = validateSkillManifest({
      ...valid,
      capabilities: [{ key: 'fitness.log', description: 'x' }],
      tools: [tool('fitness.log_workout', 'fitness.log')],
    });
    expect(errors.some((e) => e.includes('must be namespaced under skill "grocery"'))).toBe(true);
  });

  it('rejects an invalid skill key', () => {
    expect(validateSkillManifest({ ...valid, key: 'Grocery!' }).length).toBeGreaterThan(0);
  });
});
