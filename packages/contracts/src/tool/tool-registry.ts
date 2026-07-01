// The Tool Registry — the safety boundary between a probabilistic Planner and
// deterministic execution (docs/02 §11, docs/11 §2). Validates I/O, enforces
// capability + confirmation, then executes.

import type { UnifiedContext } from '../context/context.js';
import type { Tool } from './tool.js';

/** DI token for the ToolRegistryPort. */
export const TOOL_REGISTRY = Symbol('TOOL_REGISTRY');

export interface ToolExecutionOk<O = unknown> {
  status: 'ok';
  output: O;
}

export interface ToolExecutionNeedsConfirmation {
  status: 'needs_confirmation';
  /** Pass this back in `execute` opts to confirm exactly this call. */
  confirmationToken: string;
}

export interface ToolExecutionError {
  status: 'error';
  error: { code: string; message: string };
}

export type ToolExecutionResult<O = unknown> =
  | ToolExecutionOk<O>
  | ToolExecutionNeedsConfirmation
  | ToolExecutionError;

export interface ExecuteToolOptions {
  confirmationToken?: string;
}

export interface ToolRegistryPort {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  /** Tools the context is permitted to see (capability-filtered). */
  list(ctx: UnifiedContext): Tool[];
  execute(
    name: string,
    ctx: UnifiedContext,
    args: unknown,
    opts?: ExecuteToolOptions,
  ): Promise<ToolExecutionResult>;
}
