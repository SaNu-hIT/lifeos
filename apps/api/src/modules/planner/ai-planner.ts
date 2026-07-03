import { randomUUID } from 'node:crypto';
import type { AIProviderPort, ChatMessage } from '@lifeos/ai-core';
import type { ExecutionPlan, PlanInput, PlannerPort, Tool, UnifiedContext } from '@lifeos/contracts';
import { renderRecentTurns } from '../../shared/ai/render-conversation.js';
import { PlanValidator, type RawPlan } from './plan-validator.js';

/**
 * Produces an Execution Plan from intent + context + available tools using the AI
 * provider, then validates it (docs/02 §7). It ONLY generates plans — never executes
 * or mutates state (ADR-0004). If the model returns nothing usable, the turn degrades
 * to conversational (empty plan) rather than failing.
 */
export class AIPlanner implements PlannerPort {
  constructor(
    private readonly ai: AIProviderPort,
    private readonly validator = new PlanValidator(),
  ) {}

  async plan(input: PlanInput): Promise<ExecutionPlan> {
    if (input.tools.length === 0) return empty(input.intent);

    const { text } = await this.ai.complete({
      messages: buildPrompt(input.intent, input.tools, input.context),
    });
    const raw = parsePlan(text);
    if (!raw) return empty(input.intent);

    try {
      return this.validator.validate(raw, input.tools, input.intent);
    } catch {
      // The model proposed an invalid plan — reject it and stay conversational.
      return empty(input.intent);
    }
  }
}

function empty(intent: string): ExecutionPlan {
  return { planId: `pl_${randomUUID()}`, intent, steps: [], requiresUserConfirmation: false };
}

function buildPrompt(intent: string, tools: Tool[], context: UnifiedContext): ChatMessage[] {
  const catalog = tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
  return [
    {
      role: 'system',
      content:
        'You are a planner. Return ONLY JSON of the form ' +
        '{"steps":[{"tool":"<name>","args":{...}}]}. ' +
        'Use only the provided tools. Return {"steps":[]} if no tool is needed. ' +
        'Read each tool\'s "description" carefully — several tools can sound similar by name alone ' +
        '(e.g. one may search a single store while another compares every store); the description ' +
        'says which one actually matches the user\'s intent. ' +
        'Be action-oriented: when the user names concrete things that map to a tool, CALL the tool ' +
        'rather than only replying. For example, if they mention grocery items to buy (e.g. ' +
        '"milk and bread", "oil", "add eggs") add each one with the add-to-list tool — a bare list ' +
        'of items is a request to add them, even without the word "add". ' +
        'Use the recent conversation to resolve references to things the user already said ' +
        '(e.g. items they listed earlier).',
    },
    {
      role: 'user',
      content: `Recent conversation:\n${renderRecentTurns(context.conversation.recentTurns)}\n\nIntent: ${intent}\nTools: ${JSON.stringify(catalog)}`,
    },
  ];
}

/** Extract the first JSON object from the model output, tolerating surrounding text. */
function parsePlan(text: string): RawPlan | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as {
      steps?: unknown;
      suggestions?: unknown;
    };
    if (Array.isArray(obj.steps)) {
      return {
        steps: obj.steps as RawPlan['steps'],
        suggestions: Array.isArray(obj.suggestions)
          ? (obj.suggestions as RawPlan['suggestions'])
          : undefined,
      };
    }
  } catch {
    return null;
  }
  return null;
}
