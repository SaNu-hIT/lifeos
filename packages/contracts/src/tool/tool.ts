// A Tool is the unit the Planner can call — how Skills expose capability to the AI
// without the AI knowing about Skills (docs/02 §11, docs/adr/adr-0004-ai-no-business-logic.md).

import type { CapabilityKey } from '../permission/capability.js';
import type { UnifiedContext } from '../context/context.js';
import type { JSONSchema } from './json-schema.js';

export interface ToolOk<O> {
  ok: true;
  output: O;
}

export interface ToolErr {
  ok: false;
  error: { code: string; message: string };
}

/** Tools return values where possible so the Planner can react to failures. */
export type ToolResult<O> = ToolOk<O> | ToolErr;

export interface Tool<I = unknown, O = unknown> {
  /** Namespaced `<skill>.<verb_noun>`, e.g. `grocery.build_cart`. */
  name: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  requiredCapability: CapabilityKey;
  idempotent: boolean;
  requiresConfirmation: boolean;
  handler(ctx: UnifiedContext, args: I): Promise<O>;
}
