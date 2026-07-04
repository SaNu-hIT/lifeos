import type { PlanStep, Tool } from '@lifeos/contracts';

/** How the orchestrator routes a turn before (or instead of) the LLM planner. */
export type IntentKind = 'read' | 'write' | 'analysis' | 'chat';

export interface IntentClassification {
  kind: IntentKind;
  /** When kind is `read`, the read tool the policy layer must execute. */
  readTool?: Tool;
}

export interface ResolvedReadPlan {
  steps: PlanStep[];
}
