import { describe, expect, it } from 'vitest';
import { LocalAIProvider } from '@lifeos/ai-core';
import type { AIProviderPort, Completion } from '@lifeos/ai-core';
import type { Tool, UnifiedContext } from '@lifeos/contracts';
import { PlanValidator } from '../src/modules/planner/plan-validator.js';
import { AIPlanner } from '../src/modules/planner/ai-planner.js';

const schema = { type: 'object' as const, properties: { text: { type: 'string' as const } }, required: ['text'] };

function tool(name: string, requiresConfirmation = false): Tool {
  return {
    name,
    inputSchema: schema,
    outputSchema: schema,
    requiredCapability: 'sample.use',
    idempotent: true,
    requiresConfirmation,
    handler: async (_c, a) => a,
  };
}

function ctx(): UnifiedContext {
  return {
    user: { id: 'u1', locale: 'en', timezone: 'UTC' },
    capabilities: ['sample.use'],
    conversation: { id: 'c1', recentTurns: [] },
    memory: { facts: [], preferences: [], summaries: [] },
    settings: {},
    scope: 'global',
    now: '2026-06-30T00:00:00Z',
  };
}

/** A fake AI provider that returns a fixed completion (to drive the planner). */
function fakeAI(text: string, onComplete?: (messages: unknown) => void): AIProviderPort {
  return {
    name: 'fake',
    complete: async (req): Promise<Completion> => {
      onComplete?.(req.messages);
      return { text, model: 'fake' };
    },
    async *stream() {
      yield { text };
    },
    embed: async (t) => t.map(() => []),
  };
}

describe('PlanValidator', () => {
  const validator = new PlanValidator();
  const tools = [tool('sample.echo'), tool('sample.place_order', true)];

  it('accepts a valid plan and flags confirmation', () => {
    const plan = validator.validate(
      { steps: [{ tool: 'sample.place_order', args: { text: 'x' } }] },
      tools,
      'order',
    );
    expect(plan.steps).toHaveLength(1);
    expect(plan.requiresUserConfirmation).toBe(true);
  });

  it('rejects a plan referencing an unknown tool', () => {
    expect(() => validator.validate({ steps: [{ tool: 'sample.nope', args: {} }] }, tools, 'x')).toThrow(
      /unknown or unavailable tool/,
    );
  });

  it('rejects a plan with schema-invalid args', () => {
    expect(() =>
      validator.validate({ steps: [{ tool: 'sample.echo', args: { wrong: 1 } }] }, tools, 'x'),
    ).toThrow(/invalid args/);
  });
});

describe('AIPlanner', () => {
  const tools = [tool('sample.echo')];

  it('produces a validated plan from the model output', async () => {
    const planner = new AIPlanner(
      fakeAI('Here is the plan: {"steps":[{"tool":"sample.echo","args":{"text":"hi"}}]}'),
    );
    const plan = await planner.plan({ intent: 'say hi', context: ctx(), tools });
    expect(plan.steps).toEqual([{ tool: 'sample.echo', args: { text: 'hi' } }]);
  });

  it('degrades to an empty plan when the model output is not a usable plan', async () => {
    const planner = new AIPlanner(new LocalAIProvider()); // echoes, no JSON
    const plan = await planner.plan({ intent: 'say hi', context: ctx(), tools });
    expect(plan.steps).toEqual([]);
  });

  it('degrades to empty when the model proposes an invalid tool', async () => {
    const planner = new AIPlanner(fakeAI('{"steps":[{"tool":"sample.hacker","args":{}}]}'));
    const plan = await planner.plan({ intent: 'x', context: ctx(), tools });
    expect(plan.steps).toEqual([]);
  });

  it('returns an empty plan when no tools are available', async () => {
    const planner = new AIPlanner(fakeAI('{"steps":[{"tool":"x","args":{}}]}'));
    const plan = await planner.plan({ intent: 'x', context: ctx(), tools: [] });
    expect(plan.steps).toEqual([]);
  });

  it('includes recent conversation turns in the prompt sent to the model', async () => {
    let sentMessages: unknown;
    const planner = new AIPlanner(fakeAI('{"steps":[]}', (m) => (sentMessages = m)));
    const withHistory: UnifiedContext = {
      ...ctx(),
      conversation: {
        id: 'c1',
        recentTurns: [
          { id: 't2', role: 'assistant', content: 'Found Amul Milk.', createdAt: '2026-06-30T00:01:00Z' },
          { id: 't1', role: 'user', content: 'milk,cheese,pazham', createdAt: '2026-06-30T00:00:00Z' },
        ],
      },
    };
    await planner.plan({ intent: 'analyze my shopping list', context: withHistory, tools });
    const rendered = JSON.stringify(sentMessages);
    expect(rendered).toContain('milk,cheese,pazham');
    expect(rendered).toContain('Found Amul Milk.');
  });
});
