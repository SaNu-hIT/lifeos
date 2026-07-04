import { describe, expect, it } from 'vitest';
import type { Tool, UnifiedContext } from '@lifeos/contracts';
import { classifyIntent } from '../src/modules/intent/intent-router.js';
import { matchReadTool } from '../src/modules/intent/read-tool-matcher.js';
import { resolveReadPlan } from '../src/modules/intent/read-plan-resolver.js';
import { isReadTool } from '../src/modules/intent/tool-classifier.js';

const schema = { type: 'object' as const, properties: {}, required: [] as string[] };

function tool(name: string, overrides: Partial<Tool> = {}): Tool {
  return {
    name,
    inputSchema: schema,
    outputSchema: schema,
    requiredCapability: 'sample.use',
    idempotent: true,
    requiresConfirmation: false,
    handler: async () => ({}),
    ...overrides,
  };
}

function calendarTools(): Tool[] {
  return [
    tool('calendar.list_events', {
      inputSchema: {
        type: 'object',
        properties: { from: { type: 'string' }, to: { type: 'string' } },
        required: ['from', 'to'],
      },
    }),
    tool('calendar.schedule_event', {
      requiresConfirmation: true,
      idempotent: false,
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          startsAt: { type: 'string' },
          endsAt: { type: 'string' },
        },
        required: ['title', 'startsAt', 'endsAt'],
      },
    }),
    tool('grocery.get_list', {
      inputSchema: { type: 'object', properties: {} },
    }),
  ];
}

function ctx(): UnifiedContext {
  return {
    user: { id: 'u1', locale: 'en', timezone: 'UTC' },
    capabilities: ['calendar.read', 'calendar.write'],
    conversation: { id: 'c1', recentTurns: [] },
    memory: { facts: [], preferences: [], summaries: [] },
    settings: {},
    scope: 'global',
    now: '2026-07-05T12:00:00.000Z',
  };
}

describe('intent router — state query classification', () => {
  it('classifies "any meetings tomorrow?" as read with calendar.list_events', () => {
    const tools = calendarTools();
    const intent = classifyIntent('Any meetings tomorrow?', tools, ctx());
    expect(intent.kind).toBe('read');
    expect(intent.readTool?.name).toBe('calendar.list_events');
  });

  it('classifies schedule requests as write', () => {
    const intent = classifyIntent('Schedule a meeting at 10 AM', calendarTools(), ctx());
    expect(intent.kind).toBe('write');
  });

  it('classifies capability questions as chat', () => {
    const intent = classifyIntent('what all can I do?', calendarTools(), ctx());
    expect(intent.kind).toBe('chat');
  });

  it('resolves date args for tomorrow on calendar.list_events', () => {
    const readTool = matchReadTool('Any meetings tomorrow?', calendarTools())!;
    expect(readTool.name).toBe('calendar.list_events');
    const plan = resolveReadPlan(readTool, 'Any meetings tomorrow?', ctx());
    const args = plan.steps[0]!.args as { from: string; to: string };
    expect(args.from).toContain('2026-07-06');
    expect(args.to).toContain('2026-07-06');
  });

  it('detects read tools by naming convention', () => {
    expect(isReadTool(tool('grocery.get_list'))).toBe(true);
    expect(isReadTool(tool('calendar.schedule_event', { requiresConfirmation: true }))).toBe(false);
  });
});
