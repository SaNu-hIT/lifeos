import {
  type ExecuteToolOptions,
  type PermissionPort,
  type Tool,
  type ToolExecutionResult,
  type ToolRegistryPort,
  type UnifiedContext,
  isValidToolName,
} from '@lifeos/contracts';
import type { AuditLog } from '../../shared/audit/audit-log.js';
import { SchemaValidator } from './schema-validator.js';
import { computeConfirmationToken } from './confirmation.js';

function error(code: string, message: string): ToolExecutionResult {
  return { status: 'error', error: { code, message } };
}

/**
 * Holds tools and executes them safely: validate input → permission check →
 * confirmation → run → validate output → audit. A malformed or unauthorized call
 * never reaches the handler (docs/02 §11, docs/11 §2). The registry imports no Skill.
 */
export class ToolRegistry implements ToolRegistryPort {
  private readonly tools = new Map<string, Tool>();

  constructor(
    private readonly permissions: PermissionPort,
    private readonly audit: AuditLog,
    private readonly validator: SchemaValidator,
    private readonly confirmationSecret: string,
  ) {}

  register(tool: Tool): void {
    if (!isValidToolName(tool.name)) {
      throw new Error(`invalid tool name: ${tool.name}`);
    }
    if (this.tools.has(tool.name)) {
      throw new Error(`tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(ctx: UnifiedContext): Tool[] {
    return [...this.tools.values()].filter((tool) =>
      ctx.capabilities.includes(tool.requiredCapability),
    );
  }

  async execute(
    name: string,
    ctx: UnifiedContext,
    args: unknown,
    opts?: ExecuteToolOptions,
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);
    if (!tool) return error('NOT_FOUND', `unknown tool: ${name}`);

    // 1. Validate input — a bad call never reaches the handler.
    const input = this.validator.validate(tool.inputSchema, args);
    if (!input.valid) return error('VALIDATION_INVALID', `tool input invalid: ${input.errors}`);

    // 2. Capability check (the Permission Engine audits denials itself).
    const decision = await this.permissions.can(ctx.user.id, tool.requiredCapability, tool.name);
    if (!decision.allow) {
      return error('PERMISSION_DENIED', decision.reason ?? 'permission denied');
    }

    // 3. Confirmation for consequential tools.
    if (tool.requiresConfirmation) {
      const expected = computeConfirmationToken(this.confirmationSecret, name, args, ctx.user.id);
      if (opts?.confirmationToken !== expected) {
        return { status: 'needs_confirmation', confirmationToken: expected };
      }
    }

    // 4. Execute — handler faults become error results, never crash the caller.
    let output: unknown;
    try {
      output = await tool.handler(ctx, args);
    } catch {
      await this.audit.record({
        userId: ctx.user.id,
        actor: 'system',
        action: 'tool.execute',
        resource: name,
        decision: 'error',
      });
      return error('INTERNAL', `tool execution failed: ${name}`);
    }

    // 5. Validate output, then audit success.
    const out = this.validator.validate(tool.outputSchema, output);
    if (!out.valid) return error('INTERNAL', `tool output invalid: ${out.errors}`);

    await this.audit.record({
      userId: ctx.user.id,
      actor: 'system',
      action: 'tool.execute',
      resource: name,
      decision: 'ok',
    });
    return { status: 'ok', output };
  }
}
