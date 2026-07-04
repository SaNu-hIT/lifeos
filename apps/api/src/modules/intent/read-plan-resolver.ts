import type { PlanStep, Tool, UnifiedContext } from '@lifeos/contracts';
import { resolveDateRange, resolveLookbackDays } from './date-bounds.js';
import type { ResolvedReadPlan } from './intent.types.js';

/** Build a validated plan step for a mandatory read tool, filling temporal args from context. */
export function resolveReadPlan(tool: Tool, message: string, ctx: UnifiedContext): ResolvedReadPlan {
  const args = buildReadArgs(tool, message, ctx);
  return { steps: [{ tool: tool.name, args }] };
}

function buildReadArgs(tool: Tool, message: string, ctx: UnifiedContext): Record<string, unknown> {
  const schema = tool.inputSchema as {
    properties?: Record<string, { type?: string }>;
    required?: string[];
  };
  const required = schema.required ?? [];
  const props = schema.properties ?? {};
  if (required.length === 0) return {};

  const range = resolveDateRange(message, ctx.now);
  const lookback = resolveLookbackDays(message);
  const args: Record<string, unknown> = {};

  for (const key of required) {
    const type = props[key]?.type;
    const lower = key.toLowerCase();

    if (lower === 'from' || lower === 'windowstart') {
      args[key] = range.from;
    } else if (lower === 'to' || lower === 'windowend') {
      args[key] = range.to;
    } else if (lower === 'lookbackdays') {
      args[key] = lookback;
    } else if (lower === 'lookbacksessions') {
      args[key] = 10;
    } else if (lower === 'durationminutes') {
      args[key] = 30;
    } else if (lower === 'exercisename') {
      const match = message.match(/\b(bench|squat|deadlift|press|curl|row)\w*\b/i);
      args[key] = match?.[0] ?? 'exercise';
    } else if (type === 'integer' || type === 'number') {
      args[key] = 1;
    } else if (type === 'string') {
      args[key] = message.trim() || key;
    }
  }

  return args;
}
