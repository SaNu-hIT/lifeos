import { describe, expect, it, vi } from 'vitest';
import { LocalAIProvider } from '@lifeos/ai-core';
import type {
  CapabilityKey,
  ExecutionPlan,
  PermissionDecision,
  PermissionPort,
  PlannerPort,
  Tool,
  UnifiedContext,
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
  registry.register(echo);
  registry.register(order);
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
    );

    const result = await orch.handleTurn({ userId: 'u1', conversationId: 'c1', content: 'say hi' });
    expect(result.status).toBe('completed');
    expect(appended.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(result.assistantMessage?.content).toContain('sample.echo');
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
});
