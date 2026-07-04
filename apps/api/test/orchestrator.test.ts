import { describe, expect, it, vi } from 'vitest';
import { LocalAIProvider } from '@lifeos/ai-core';
import type { AIProviderPort } from '@lifeos/ai-core';
import {
  ClarificationRequiredError,
  type CapabilityKey,
  type ExecutionPlan,
  type PermissionDecision,
  type PermissionPort,
  type PlannerPort,
  type Tool,
  type UnifiedContext,
} from '@lifeos/contracts';
import { ToolRegistry } from '../src/modules/tool-registry/tool-registry.js';
import { SchemaValidator } from '../src/modules/tool-registry/schema-validator.js';
import type { AuditLog } from '../src/shared/audit/audit-log.js';
import { Orchestrator } from '../src/modules/orchestrator/orchestrator.js';
import type { ConversationPort } from '../src/modules/conversation/domain/ports/conversation.port.js';
import type { ContextEnginePort } from '../src/modules/context/domain/ports/context-engine.port.js';
import type { MemoryPort } from '../src/modules/memory/domain/ports/memory.port.js';

const allowAll: PermissionPort = {
  can: async (): Promise<PermissionDecision> => ({ allow: true }),
  capabilitiesFor: async () => ['sample.use', 'sample.order'] as CapabilityKey[],
};
const noopAudit = { record: async () => undefined } as unknown as AuditLog;
const schema = { type: 'object' as const, properties: { text: { type: 'string' as const } }, required: ['text'] };

function ctx(): UnifiedContext {
  return {
    user: { id: 'u1', locale: 'en', timezone: 'UTC' },
    capabilities: ['sample.use', 'sample.order'],
    conversation: { id: 'c1', recentTurns: [] },
    memory: { facts: [], preferences: [], summaries: [] },
    settings: {},
    scope: 'global',
    now: '2026-06-30T00:00:00Z',
  };
}

function buildRegistry(): ToolRegistry {
  const registry = new ToolRegistry(allowAll, noopAudit, new SchemaValidator(), 'secret');
  const echo: Tool = {
    name: 'sample.echo',
    inputSchema: schema,
    outputSchema: schema,
    requiredCapability: 'sample.use',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (_c, args) => args,
  };
  const order: Tool = {
    name: 'sample.place_order',
    inputSchema: schema,
    outputSchema: schema,
    requiredCapability: 'sample.order',
    idempotent: false,
    requiresConfirmation: true,
    handler: async (_c, args) => args,
  };
  const ambiguous: Tool = {
    name: 'sample.compare',
    inputSchema: { type: 'object' as const, properties: {} },
    outputSchema: { type: 'object' as const, properties: {} },
    requiredCapability: 'sample.use',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (_c, args: unknown) => {
      const selections = (args as { selections?: Record<string, unknown> } | undefined)?.selections;
      if (!selections) {
        throw new ClarificationRequiredError([{ productName: 'milk', options: [{ brand: 'A' }, { brand: 'B' }] }]);
      }
      return { resolved: selections };
    },
  };
  // Emits a result-aware follow-up button: present only when output.more is truthy.
  const suggest: Tool = {
    name: 'sample.suggest',
    inputSchema: { type: 'object' as const, properties: { more: { type: 'boolean' as const } } },
    outputSchema: { type: 'object' as const, properties: { more: { type: 'boolean' as const } } },
    requiredCapability: 'sample.use',
    idempotent: true,
    requiresConfirmation: false,
    followUpsFor: (out) =>
      (out as { more?: boolean }).more ? [{ label: 'Do the next step', prompt: 'next step' }] : [],
    handler: async (_c, args) => args,
  };
  registry.register(echo);
  registry.register(order);
  registry.register(ambiguous);
  registry.register(suggest);
  return registry;
}

/** Same tools as `buildRegistry()`, plus one tool gated behind a capability `ctx()`
 *  never grants — used only by the locked-intent detection tests, kept separate so
 *  every other test's `listAll()` result (and therefore behavior) is unaffected. */
function buildRegistryWithLockedTool(): ToolRegistry {
  const registry = buildRegistry();
  registry.register({
    name: 'premium.advanced_report',
    description: 'Generate an advanced report.',
    inputSchema: { type: 'object' as const, properties: {} },
    outputSchema: { type: 'object' as const, properties: {} },
    requiredCapability: 'premium.use',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (_c, args) => args,
  });
  return registry;
}

function stubConversation() {
  const appended: { role: string; content: unknown }[] = [];
  const conversation: ConversationPort = {
    start: async () => ({ id: 'c1' }),
    appendMessage: async (input) => {
      appended.push({ role: input.role, content: input.content });
      return {
        id: `m${appended.length}`,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        createdAt: '2026-06-30T00:00:00Z',
      };
    },
    history: async () => ({ data: [] }),
    recentTurns: async () => [],
  };
  return { conversation, appended };
}

const stubContext: ContextEnginePort = { assemble: async () => ctx() };
const stubMemory = { writeSummary: vi.fn(async () => undefined) } as unknown as MemoryPort;
const stubPlans = { plansGranting: async () => [] };
const upgradeUrl = 'https://app.lifeos.example/upgrade';

/** A fake AI provider that captures the messages it receives (to inspect the summarizer prompt). */
function capturingAI(onComplete: (messages: unknown) => void): AIProviderPort {
  return {
    name: 'fake',
    complete: async (req) => {
      onComplete(req.messages);
      return { text: 'ok', model: 'fake' };
    },
    async *stream() {
      yield { text: 'ok' };
    },
    embed: async (t) => t.map(() => []),
  };
}

/** A fake AI provider that returns one scripted response per call (in order) and
 *  records every call's messages — used to test the locked-intent classification
 *  call followed by the summarizer call. */
function scriptedAI(responses: string[]): { ai: AIProviderPort; calls: unknown[] } {
  const calls: unknown[] = [];
  let i = 0;
  const ai: AIProviderPort = {
    name: 'fake',
    complete: async (req) => {
      calls.push(req.messages);
      const text = responses[i] ?? responses[responses.length - 1] ?? 'ok';
      i += 1;
      return { text, model: 'fake' };
    },
    async *stream() {
      yield { text: 'ok' };
    },
    embed: async (t) => t.map(() => []),
  };
  return { ai, calls };
}

function planWith(...steps: { tool: string; args: unknown }[]): PlannerPort {
  return {
    plan: async (): Promise<ExecutionPlan> => ({
      planId: 'pl_1',
      intent: 'x',
      steps,
      requiresUserConfirmation: false,
    }),
  };
}

describe('Orchestrator turn loop', () => {
  it('runs a plan, executes a tool, and persists an assistant reply', async () => {
    const registry = buildRegistry();
    const { conversation, appended } = stubConversation();
    const orch = new Orchestrator(
      conversation,
      stubContext,
      registry,
      new LocalAIProvider(),
      stubMemory,
      planWith({ tool: 'sample.echo', args: { text: 'hi' } }),
      stubPlans,
      upgradeUrl,
    );

    const result = await orch.handleTurn({ userId: 'u1', conversationId: 'c1', content: 'say hi' });
    expect(result.status).toBe('completed');
    expect(appended.map((m) => m.role)).toEqual(['user', 'assistant']);
    // The reply is a readable summary of the tool result (not raw JSON).
    expect(result.assistantMessage?.content).toContain('echo');
    expect(result.assistantMessage?.content).toContain('hi');
  });

  it('surfaces needs_confirmation, then completes with the token on the next turn', async () => {
    const registry = buildRegistry();
    const { conversation } = stubConversation();
    const orch = new Orchestrator(
      conversation,
      stubContext,
      registry,
      new LocalAIProvider(),
      stubMemory,
      planWith({ tool: 'sample.place_order', args: { text: 'order' } }),
      stubPlans,
      upgradeUrl,
    );

    const first = await orch.handleTurn({ userId: 'u1', conversationId: 'c1', content: 'order it' });
    expect(first.status).toBe('awaiting_confirmation');
    expect(first.confirmation?.toolName).toBe('sample.place_order');

    const confirmed = await orch.handleTurn({
      userId: 'u1',
      conversationId: 'c1',
      content: 'order it',
      confirmation: first.confirmation,
    });
    expect(confirmed.status).toBe('completed');
  });

  it('pauses on awaiting_clarification before the summarizer, then resumes with the answer', async () => {
    const registry = buildRegistry();
    const { conversation, appended } = stubConversation();
    const orch = new Orchestrator(
      conversation,
      stubContext,
      registry,
      new LocalAIProvider(),
      stubMemory,
      planWith({ tool: 'sample.compare', args: {} }),
      stubPlans,
      upgradeUrl,
    );

    const first = await orch.handleTurn({ userId: 'u1', conversationId: 'c1', content: 'compare my list' });
    expect(first.status).toBe('awaiting_clarification');
    expect(first.clarification?.toolName).toBe('sample.compare');
    expect(first.clarification?.choices).toEqual([
      { productName: 'milk', options: [{ brand: 'A' }, { brand: 'B' }] },
    ]);
    // No assistant reply is persisted while paused — only the user message so far.
    expect(appended.map((m) => m.role)).toEqual(['user']);

    const resumed = await orch.handleTurn({
      userId: 'u1',
      conversationId: 'c1',
      content: 'compare my list',
      clarification: { toolName: 'sample.compare', selections: { milk: { brand: 'A' } } },
    });
    expect(resumed.status).toBe('completed');
    expect(appended.map((m) => m.role)).toEqual(['user', 'user', 'assistant']);
  });

  it('surfaces a tool\'s result-aware follow-up as a suggested action, and hides it when not relevant', async () => {
    const registry = buildRegistry();
    const { conversation } = stubConversation();
    const mk = (more: boolean) =>
      new Orchestrator(
        conversation,
        stubContext,
        registry,
        new LocalAIProvider(),
        stubMemory,
        planWith({ tool: 'sample.suggest', args: { more } }),
        stubPlans,
        upgradeUrl,
      );

    const withButton = await mk(true).handleTurn({ userId: 'u1', conversationId: 'c1', content: 'go' });
    expect(withButton.suggestedActions).toEqual([{ label: 'Do the next step', prompt: 'next step' }]);

    const noButton = await mk(false).handleTurn({ userId: 'u1', conversationId: 'c1', content: 'go' });
    expect(noButton.suggestedActions).toBeUndefined();
  });

  it('ignores planner-proposed suggestions — buttons come only from executed tools', async () => {
    const registry = buildRegistry();
    const { conversation } = stubConversation();
    // A planner that both runs a no-button tool AND proposes a suggestion of its own.
    const plannerWithSuggestions: PlannerPort = {
      plan: async (): Promise<ExecutionPlan> => ({
        planId: 'pl_1',
        intent: 'x',
        steps: [{ tool: 'sample.suggest', args: { more: false } }],
        requiresUserConfirmation: false,
        suggestions: [{ label: 'Stale planner button', prompt: 'stale' }],
      }),
    };
    const orch = new Orchestrator(
      conversation,
      stubContext,
      registry,
      new LocalAIProvider(),
      stubMemory,
      plannerWithSuggestions,
      stubPlans,
      upgradeUrl,
    );

    const result = await orch.handleTurn({ userId: 'u1', conversationId: 'c1', content: 'go' });
    expect(result.suggestedActions).toBeUndefined();
  });

  it('includes recent conversation turns in the summarizer prompt', async () => {
    const registry = buildRegistry();
    const { conversation } = stubConversation();
    const contextWithHistory: ContextEnginePort = {
      assemble: async () => ({
        ...ctx(),
        conversation: {
          id: 'c1',
          recentTurns: [
            { id: 't1', role: 'user', content: 'milk,cheese,pazham', createdAt: '2026-06-30T00:00:00Z' },
          ],
        },
      }),
    };
    let sentMessages: unknown;
    const orch = new Orchestrator(
      conversation,
      contextWithHistory,
      registry,
      capturingAI((m) => (sentMessages = m)),
      stubMemory,
      planWith(),
      stubPlans,
      upgradeUrl,
    );

    await orch.handleTurn({
      userId: 'u1',
      conversationId: 'c1',
      content: 'analyze my shopping list',
    });
    expect(JSON.stringify(sentMessages)).toContain('milk,cheese,pazham');
  });

  it('nudges an upgrade when an empty plan actually matches a locked tool', async () => {
    const registry = buildRegistryWithLockedTool();
    const { conversation } = stubConversation();
    const { ai, calls } = scriptedAI([
      '{"matched":true,"toolName":"premium.advanced_report"}', // classification call
      'Sure — here is the info.', // summarizer call
    ]);
    const plans = { plansGranting: async () => [{ key: 'pro', name: 'Pro' }] };
    const orch = new Orchestrator(
      conversation,
      stubContext,
      registry,
      ai,
      stubMemory,
      planWith(), // empty plan — the trigger condition
      plans,
      upgradeUrl,
    );

    const result = await orch.handleTurn({
      userId: 'u1',
      conversationId: 'c1',
      content: 'generate my advanced report',
    });

    expect(result.status).toBe('completed');
    expect(result.suggestedActions).toEqual([
      { label: 'See upgrade options', prompt: 'What plans are available?', url: upgradeUrl },
    ]);
    expect(calls).toHaveLength(2);
    // The classification call sees the locked tool; the summarizer call gets a note
    // referencing it (plan name sourced from the lookup, not invented by the model).
    expect(JSON.stringify(calls[0])).toContain('premium.advanced_report');
    expect(JSON.stringify(calls[1])).toContain('Pro');
  });

  it('grounds the summarizer in the user\'s available tools when the plan is empty and nothing is locked', async () => {
    const registry = buildRegistry();
    const { conversation } = stubConversation();
    let sentMessages: unknown;
    const orch = new Orchestrator(
      conversation,
      stubContext,
      registry,
      capturingAI((m) => (sentMessages = m)),
      stubMemory,
      planWith(), // empty plan — "what can you do?" style turn, no locked tool involved
      stubPlans,
      upgradeUrl,
    );

    await orch.handleTurn({ userId: 'u1', conversationId: 'c1', content: 'what all can I do?' });

    const serialized = JSON.stringify(sentMessages);
    // The user's permitted tools (name/description) reach the summarizer prompt...
    expect(serialized).toContain('sample.echo');
    expect(serialized).toContain('sample.place_order');
    // ...but a tool the user can't use is never mentioned as available.
    expect(serialized).not.toContain('premium.advanced_report');
  });

  it('does not run the locked-intent classification call when the plan is non-empty', async () => {
    const registry = buildRegistryWithLockedTool();
    const { conversation } = stubConversation();
    const { ai, calls } = scriptedAI(['ok']);
    const plans = { plansGranting: async () => [{ key: 'pro', name: 'Pro' }] };
    const orch = new Orchestrator(
      conversation,
      stubContext,
      registry,
      ai,
      stubMemory,
      planWith({ tool: 'sample.echo', args: { text: 'hi' } }),
      plans,
      upgradeUrl,
    );

    const result = await orch.handleTurn({ userId: 'u1', conversationId: 'c1', content: 'say hi' });

    expect(result.status).toBe('completed');
    // Only the summarizer call — no classification call was made.
    expect(calls).toHaveLength(1);
    expect(result.suggestedActions).toBeUndefined();
  });
});
