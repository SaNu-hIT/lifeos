import { randomUUID } from 'node:crypto';
import {
  ErrorCodes,
  type ExecutionPlan,
  type FollowUpSuggestion,
  LifeOSError,
  type PlanStep,
  type Tool,
} from '@lifeos/contracts';
import { SchemaValidator } from '../tool-registry/schema-validator.js';

export interface RawPlanStep {
  tool: string;
  args: unknown;
}
export interface RawPlanSuggestion {
  label?: unknown;
  prompt?: unknown;
}
export interface RawPlan {
  steps: RawPlanStep[];
  suggestions?: RawPlanSuggestion[];
}

/**
 * Validates a raw (LLM-produced) plan against the tools the user is permitted to use.
 * A plan referencing an unknown/unavailable tool, or with schema-invalid args, is
 * REJECTED — invalid tool calls never reach execution (docs/02 §7, docs/11 §2).
 */
export class PlanValidator {
  constructor(private readonly validator = new SchemaValidator()) {}

  validate(raw: RawPlan, tools: Tool[], intent: string): ExecutionPlan {
    const byName = new Map(tools.map((t) => [t.name, t]));
    const steps: PlanStep[] = [];
    let requiresUserConfirmation = false;

    for (const step of raw.steps ?? []) {
      const tool = byName.get(step.tool);
      if (!tool) {
        throw new LifeOSError({
          code: ErrorCodes.VALIDATION_INVALID,
          status: 422,
          message: `plan references an unknown or unavailable tool: ${step.tool}`,
        });
      }
      const check = this.validator.validate(tool.inputSchema, step.args);
      if (!check.valid) {
        throw new LifeOSError({
          code: ErrorCodes.VALIDATION_INVALID,
          status: 422,
          message: `invalid args for ${step.tool}: ${check.errors}`,
        });
      }
      if (tool.requiresConfirmation) requiresUserConfirmation = true;
      steps.push({ tool: step.tool, args: step.args });
    }

    const suggestions = this.validateSuggestions(raw.suggestions, tools);

    return {
      planId: `pl_${randomUUID()}`,
      intent,
      steps,
      requiresUserConfirmation,
      ...(suggestions.length > 0 ? { suggestions } : {}),
    };
  }

  /**
   * Keeps only suggestions that exactly match a followUp DECLARED by one of the
   * available tools — the same safety principle as tool-name validation: the LLM
   * can pick from the skills' offered actions but cannot invent a button (which
   * could send an arbitrary prompt). Deduped by label.
   */
  private validateSuggestions(
    raw: RawPlanSuggestion[] | undefined,
    tools: Tool[],
  ): FollowUpSuggestion[] {
    if (!raw?.length) return [];
    const declared = new Map<string, FollowUpSuggestion>();
    for (const tool of tools) {
      for (const followUp of tool.followUps ?? []) {
        declared.set(followUp.label, followUp);
      }
    }
    const out: FollowUpSuggestion[] = [];
    const seen = new Set<string>();
    for (const s of raw) {
      if (typeof s?.label !== 'string') continue;
      const match = declared.get(s.label);
      if (match && !seen.has(match.label)) {
        seen.add(match.label);
        out.push(match); // use the declared copy, not the model's echo
      }
    }
    return out;
  }
}
