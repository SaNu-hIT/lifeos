import { describe, expect, it, vi } from 'vitest';
import { LocalAIProvider } from '@lifeos/ai-core';
import type { ExecutionPlan, Tool, UnifiedContext } from '@lifeos/contracts';
import { ToolRegistry } from '../src/modules/tool-registry/tool-registry.js';
import { SchemaValidator } from '../src/modules/tool-registry/schema-validator.js';
import type { AuditLog } from '../src/shared/audit/audit-log.js';
import { Orchestrator } from '../src/modules/orchestrator/orchestrator.js';
import type { ConversationPort } from '../src/modules/conversation/domain/ports/conversation.port.js';
import type { ContextEnginePort } from '../src/modules/context/domain/ports/context-engine.port.js';
import type { MemoryPort } from '../src/modules/memory/domain/ports/memory.port.js';
import type { PlannerPort } from '@lifeos/contracts';

const noopAudit = { record: async () => undefined } as unknown as AuditLog;

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
        createdAt: '2026-07-05T12:00:00Z',
      };
    },
    history: async () => ({ data: [] }),
    recentTurns: async () => [],
  };
  return { conversation, appended };
}

describe('Orchestrator — read state-awareness', () => {
  it('executes calendar.list_events for a meeting query instead of answering from history', async () => {
    const events = [{ title: 'Standup', startsAt: '2026-07-06T10:00:00.000Z', endsAt: '2026-07-06T10:30:00.000Z' }];
    const registry = new ToolRegistry(
      { can: async () => ({ allow: true }), capabilitiesFor: async () => ['calendar.read'] },
      noopAudit,
      new SchemaValidator(),
      'secret',
    );
    const listTool: Tool = {
      name: 'calendar.list_events',
      inputSchema: {
        type: 'object',
        properties: { from: { type: 'string' }, to: { type: 'string' } },
        required: ['from', 'to'],
      },
      outputSchema: { type: 'object', properties: { events: { type: 'array' } }, required: ['events'] },
      requiredCapability: 'calendar.read',
      idempotent: true,
      requiresConfirmation: false,
      handler: async () => ({ events }),
    };
    registry.register(listTool);

    const contextWithLie: ContextEnginePort = {
      assemble: async () => ({
        user: { id: 'u1', locale: 'en', timezone: 'UTC' },
        capabilities: ['calendar.read'],
        conversation: {
          id: 'c1',
          recentTurns: [
            {
              id: 't1',
              role: 'assistant',
              content: 'There are no meetings.',
              createdAt: '2026-07-05T11:00:00Z',
            },
          ],
        },
        memory: { facts: [], preferences: [], summaries: [] },
        settings: {},
        scope: 'global',
        now: '2026-07-05T12:00:00.000Z',
      }),
    };

    const planner: PlannerPort = {
      plan: async (): Promise<ExecutionPlan> => ({
        planId: 'pl_empty',
        intent: 'x',
        steps: [],
        requiresUserConfirmation: false,
      }),
    };

    const memory = { writeSummary: vi.fn(async () => undefined) } as unknown as MemoryPort;
    const { conversation } = stubConversation();

    const orch = new Orchestrator(
      conversation,
      contextWithLie,
      registry,
      new LocalAIProvider(),
      memory,
      planner,
      { plansGranting: async () => [] },
      'https://example.com/upgrade',
    );

    const result = await orch.handleTurn({
      userId: 'u1',
      conversationId: 'c1',
      content: 'Any meetings tomorrow?',
    });

    expect(result.status).toBe('completed');
    expect(result.trace?.intent).toBe('read');
    expect(result.trace?.plan[0]?.tool).toBe('calendar.list_events');
    expect(result.assistantMessage?.content).toContain('Standup');
    expect(result.assistantMessage?.content).not.toContain('no meetings');
    expect(memory.writeSummary).not.toHaveBeenCalled();
  });
});
