import { randomUUID } from 'node:crypto';
import type { ExecutionPlan, PlanInput, PlannerPort } from '@lifeos/contracts';

/**
 * Placeholder planner used until the real AI Planner lands (phase-17). It produces
 * an empty plan, so a turn is purely conversational (no tool calls). Phase-17
 * replaces this binding with an LLM-driven planner constrained to registered tools.
 */
export class NaivePlanner implements PlannerPort {
  async plan(input: PlanInput): Promise<ExecutionPlan> {
    return {
      planId: `pl_${randomUUID()}`,
      intent: input.intent,
      steps: [],
      requiresUserConfirmation: false,
    };
  }
}
