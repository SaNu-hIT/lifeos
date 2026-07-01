import { describe, expect, it, vi } from 'vitest';
import type {
  CapabilityKey,
  PermissionDecision,
  PermissionPort,
  Tool,
  UnifiedContext,
} from '@lifeos/contracts';
import { ToolRegistry } from '../src/modules/tool-registry/tool-registry.js';
import { SchemaValidator } from '../src/modules/tool-registry/schema-validator.js';
import type { AuditLog } from '../src/shared/audit/audit-log.js';

const SECRET = 'test-secret';

function permissionsAllowing(allowed: CapabilityKey[]): PermissionPort {
  return {
    can: async (_userId, capability): Promise<PermissionDecision> =>
      allowed.includes(capability)
        ? { allow: true }
        : { allow: false, reason: `missing capability: ${capability}` },
    capabilitiesFor: async () => allowed,
  };
}

function fakeAudit(): AuditLog & { records: unknown[] } {
  const records: unknown[] = [];
  return { records, record: async (e: unknown) => void records.push(e) } as never;
}

function ctx(capabilities: CapabilityKey[]): UnifiedContext {
  return {
    user: { id: 'u1', locale: 'en-IN', timezone: 'Asia/Kolkata' },
    capabilities,
    conversation: { id: 'c1', recentTurns: [] },
    memory: { facts: [], preferences: [], summaries: [] },
    settings: {},
    scope: 'test',
    now: '2026-06-30T00:00:00Z',
  };
}

const schema = { type: 'object' as const, properties: { text: { type: 'string' as const } }, required: ['text'] };

function echoTool(overrides: Partial<Tool> = {}): Tool {
  return {
    name: 'test.echo',
    inputSchema: schema,
    outputSchema: schema,
    requiredCapability: 'test.use',
    idempotent: true,
    requiresConfirmation: false,
    handler: vi.fn(async (_c, args: unknown) => args),
    ...overrides,
  };
}

function makeRegistry(allowed: CapabilityKey[]) {
  const audit = fakeAudit();
  const registry = new ToolRegistry(permissionsAllowing(allowed), audit, new SchemaValidator(), SECRET);
  return { registry, audit };
}

describe('ToolRegistry', () => {
  it('executes a valid, permitted call and audits success', async () => {
    const { registry, audit } = makeRegistry(['test.use']);
    const tool = echoTool();
    registry.register(tool);
    const res = await registry.execute('test.echo', ctx(['test.use']), { text: 'hi' });
    expect(res).toEqual({ status: 'ok', output: { text: 'hi' } });
    expect(audit.records).toHaveLength(1);
  });

  it('rejects invalid input BEFORE the handler runs', async () => {
    const { registry } = makeRegistry(['test.use']);
    const tool = echoTool();
    registry.register(tool);
    const res = await registry.execute('test.echo', ctx(['test.use']), { wrong: 1 });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.error.code).toBe('VALIDATION_INVALID');
    expect(tool.handler).not.toHaveBeenCalled();
  });

  it('denies when the capability is missing (handler not called)', async () => {
    const { registry } = makeRegistry([]); // no capabilities
    const tool = echoTool();
    registry.register(tool);
    const res = await registry.execute('test.echo', ctx([]), { text: 'hi' });
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.error.code).toBe('PERMISSION_DENIED');
    expect(tool.handler).not.toHaveBeenCalled();
  });

  it('requires confirmation, then proceeds with the returned token', async () => {
    const { registry } = makeRegistry(['test.order']);
    const tool = echoTool({
      name: 'test.place_order',
      requiredCapability: 'test.order',
      requiresConfirmation: true,
    });
    registry.register(tool);

    const first = await registry.execute('test.place_order', ctx(['test.order']), { text: 'x' });
    expect(first.status).toBe('needs_confirmation');
    const token = first.status === 'needs_confirmation' ? first.confirmationToken : '';

    const second = await registry.execute('test.place_order', ctx(['test.order']), { text: 'x' }, {
      confirmationToken: token,
    });
    expect(second.status).toBe('ok');

    // A wrong/absent token for different args is rejected (re-prompts).
    const wrong = await registry.execute('test.place_order', ctx(['test.order']), { text: 'y' }, {
      confirmationToken: token,
    });
    expect(wrong.status).toBe('needs_confirmation');
  });

  it('list() is capability-filtered', () => {
    const { registry } = makeRegistry([]);
    registry.register(echoTool({ name: 'test.read', requiredCapability: 'test.read' }));
    registry.register(echoTool({ name: 'test.write', requiredCapability: 'test.write' }));
    const visible = registry.list(ctx(['test.read'])).map((t) => t.name);
    expect(visible).toEqual(['test.read']);
  });

  it('returns NOT_FOUND for an unknown tool', async () => {
    const { registry } = makeRegistry(['test.use']);
    const res = await registry.execute('test.nope', ctx(['test.use']), {});
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.error.code).toBe('NOT_FOUND');
  });

  it('rejects duplicate or invalid registration', () => {
    const { registry } = makeRegistry(['test.use']);
    registry.register(echoTool());
    expect(() => registry.register(echoTool())).toThrow(/already registered/);
    expect(() => registry.register(echoTool({ name: 'BadName' }))).toThrow(/invalid tool name/);
  });
});
