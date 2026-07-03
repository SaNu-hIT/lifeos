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

/**
 * Thrown by a handler when it needs the user to disambiguate before it can produce
 * a result (e.g. multiple brands/pack sizes matched a search) — the dynamic
 * counterpart to the static `requiresConfirmation` gate. The Tool Registry converts
 * this into a `needs_clarification` result; it carries no business meaning to the
 * registry or orchestrator, which only relay `choices` back to the caller.
 */
export class ClarificationRequiredError<C = unknown> extends Error {
  constructor(public readonly choices: C) {
    super('tool requires clarification');
    this.name = 'ClarificationRequiredError';
  }
}

/**
 * A one-tap next step a Skill offers the user AFTER a tool succeeds — the generic
 * "you just added items; want to compare prices?" pattern. Purely declarative: the
 * Orchestrator surfaces these on the turn result and, when the user taps one, sends
 * `prompt` back as an ordinary message so the Planner routes it like any other intent.
 * This keeps the AI free of business logic (ADR-0004) while letting every Skill guide
 * the conversation to its natural next action.
 */
export interface FollowUpSuggestion {
  /** Button text shown to the user, e.g. "Compare prices across stores". */
  label: string;
  /** The message sent as if the user typed it when the button is tapped, e.g.
   *  "compare the prices of my grocery list across stores". */
  prompt: string;
}

export interface Tool<I = unknown, O = unknown> {
  /** Namespaced `<skill>.<verb_noun>`, e.g. `grocery.build_cart`. */
  name: string;
  /** What this tool does and when to use it, in plain language — the Planner sees
   *  only the name + this description + the input schema, so this is the primary
   *  signal it has for picking the right tool among several similarly-named ones
   *  (e.g. "search one store's catalog" vs "compare price across every store"). */
  description?: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  requiredCapability: CapabilityKey;
  idempotent: boolean;
  requiresConfirmation: boolean;
  /** Next-step suggestions offered to the user after this tool runs successfully.
   *  Surfaced as tappable buttons in the chat; tapping one sends its `prompt`. */
  followUps?: FollowUpSuggestion[];
  /** Computes next-step buttons from THIS run's result + context, so a Skill can offer a
   *  button only when it is actually relevant (e.g. hide it once its action is done or a
   *  no-op). Takes precedence over the static `followUps` when present — this is what makes
   *  buttons self-aware rather than always-on. */
  followUpsFor?(output: O, ctx: UnifiedContext): FollowUpSuggestion[];
  handler(ctx: UnifiedContext, args: I): Promise<O>;
}
