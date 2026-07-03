// The Tool Registry — the safety boundary between a probabilistic Planner and
// deterministic execution (docs/02 §11, docs/11 §2). Validates I/O, enforces
// capability + confirmation, then executes.

import type { UnifiedContext } from '../context/context.js';
import type { FollowUpSuggestion, Tool } from './tool.js';

/** DI token for the ToolRegistryPort. */
export const TOOL_REGISTRY = Symbol('TOOL_REGISTRY');

export interface ToolExecutionOk<O = unknown> {
  status: 'ok';
  output: O;
  /** The tool's declared next-step suggestions (if any), relayed to the caller so the
   *  surface can offer them as one-tap follow-ups. */
  followUps?: FollowUpSuggestion[];
}

export interface ToolExecutionNeedsConfirmation {
  status: 'needs_confirmation';
  /** Pass this back in `execute` opts to confirm exactly this call. */
  confirmationToken: string;
}

export interface ToolExecutionNeedsClarification<C = unknown> {
  status: 'needs_clarification';
  /** Opaque, tool-defined payload describing what's ambiguous and the options — the
   *  registry/orchestrator relay it verbatim without interpreting it. */
  choices: C;
}

export interface ToolExecutionError {
  status: 'error';
  error: { code: string; message: string };
}

export type ToolExecutionResult<O = unknown, C = unknown> =
  | ToolExecutionOk<O>
  | ToolExecutionNeedsConfirmation
  | ToolExecutionNeedsClarification<C>
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
