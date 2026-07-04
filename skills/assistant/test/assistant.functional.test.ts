import { describe, expect, it } from 'vitest';
import { runSkillContractTests } from '@lifeos/skill-sdk';
import type { UnifiedContext } from '@lifeos/contracts';
import { createAssistantSkill, type InstalledSkillSummary, type PlanCatalogPort } from '../src/index.js';

function ctxFor(capabilities: string[], nowIso = '2026-07-04T20:00:00.000Z'): UnifiedContext {
  return {
    user: { id: 'u1', locale: 'en-IN', timezone: 'Asia/Kolkata' },
    capabilities: capabilities as UnifiedContext['capabilities'],
    conversation: { id: 'c1', recentTurns: [] },
    memory: { facts: [], preferences: [], summaries: [] },
    settings: {},
    scope: 'assistant',
    now: nowIso,
  };
}

const installedSkills: InstalledSkillSummary[] = [
  {
    key: 'grocery',
    title: 'Grocery',
    description: 'Manage a shopping list and compare prices.',
    capabilities: [
      { key: 'grocery.read', description: 'Search products and build a cart' },
      { key: 'grocery.order', description: 'Place grocery orders' },
    ],
  },
  {
    key: 'calendar',
    title: 'Calendar',
    description: 'View and schedule events.',
    capabilities: [
      { key: 'calendar.read', description: 'View events and find free slots' },
      { key: 'calendar.write', description: 'Schedule calendar events' },
    ],
  },
];

class FakePlanCatalog implements PlanCatalogPort {
  async currentPlan(): Promise<string | undefined> {
    return 'free';
  }
  async plansGranting(capabilityKeys: string[]) {
    return capabilityKeys.map((capabilityKey) => ({
      capabilityKey,
      plans: [{ key: 'pro', name: 'Pro' }],
    }));
  }
}

function build() {
  return createAssistantSkill({
    installedSkills,
    planCatalog: new FakePlanCatalog(),
    upgradeUrl: 'https://app.lifeos.example/upgrade',
  });
}

describe('assistant skill', () => {
  it('passes the skill contract', () => {
    runSkillContractTests(build());
  });

  it('splits capabilities into available vs locked, attaching unlock plans', async () => {
    const manifest = build();
    const tool = manifest.tools.find((t) => t.name === 'assistant.list_capabilities')!;
    const ctx = ctxFor(['assistant.use', 'grocery.read', 'calendar.read']);

    const result = await tool.handler(ctx, {});

    expect(result.currentPlan).toBe('free');
    expect(result.upgradeUrl).toBe('https://app.lifeos.example/upgrade');
    expect(result.available.map((c) => c.capabilityKey).sort()).toEqual(
      ['calendar.read', 'grocery.read'].sort(),
    );
    const locked = result.locked.find((c) => c.capabilityKey === 'grocery.order');
    expect(locked).toBeDefined();
    expect(locked!.unlockedByPlans).toEqual([{ key: 'pro', name: 'Pro' }]);
    expect(result.locked.map((c) => c.capabilityKey).sort()).toEqual(
      ['calendar.write', 'grocery.order'].sort(),
    );
  });
});
