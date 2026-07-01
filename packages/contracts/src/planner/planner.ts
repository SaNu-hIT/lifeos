// The Planner produces an Execution Plan — an ordered, dependency-aware set of
// validated tool calls. It NEVER executes or mutates state (docs/02 §7, ADR-0004).

import type { UnifiedContext } from '../context/context.js';
import type { Tool } from '../tool/tool.js';

/** DI token for the PlannerPort. */
export const PLANNER = Symbol('PLANNER');

export interface PlanStep {
  tool: string;
  args: unknown;
  dependsOn?: string[];
}

export interface ExecutionPlan {
  planId: string;
  intent: string;
  steps: PlanStep[];
  requiresUserConfirmation: boolean;
}

export interface PlanInput {
  intent: string;
  context: UnifiedContext;
  /** The tools the user is permitted to use (already capability-filtered). */
  tools: Tool[];
}

export interface PlannerPort {
  plan(input: PlanInput): Promise<ExecutionPlan>;
}
