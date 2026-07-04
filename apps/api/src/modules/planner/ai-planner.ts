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
        'This applies to every domain the tools cover, not just grocery: if the user expresses intent ' +
        'to start or continue using a capability the platform already has a tool for (e.g. "track my ' +
        'workouts", "track my period", "schedule a meeting"), CALL the relevant tool(s) yourself — ' +
        'save a profile, fetch a history summary, log an entry — rather than describing what the ' +
        'feature could do or recommending third-party apps/services as a substitute. The platform IS ' +
        'the app the user is asking about; never suggest they go use a different product for something ' +
        'a listed tool already does. If a tool\'s own description says to ask onboarding questions ' +
        'before proceeding (e.g. no history yet), ask those questions in your reply — do not skip both ' +
        'the tool call and the onboarding questions by giving a generic informational answer instead. ' +
        'Use the recent conversation to resolve references to things the user already said ' +
        '(e.g. items they listed earlier). A short reply that only makes sense as an answer to ' +
        'something the assistant just asked (or as a continuation of the domain just discussed) is ' +
        'still a tool call, not chit-chat — e.g. if the assistant just discussed the user\'s period/' +
        'workout/habit/expense and the user replies with a terse update like "started today", ' +
        '"flow is light", "did it", or "50 for lunch", resolve it against that same domain\'s log/ ' +
        'track tool using the recent conversation for any missing fields, rather than returning ' +
        '{"steps":[]}. ' +
        'Never withhold a tool call just because an OPTIONAL field (not in the schema\'s ' +
        '"required" list) is unknown — call the tool now with only the fields you have; the tool ' +
        'itself will ask for anything else it still needs afterward. For example, "my period ' +
        'started today" has a date but no flow intensity — call the log tool with just the date ' +
        'rather than asking the user for the flow in your reply and skipping the call. Only skip ' +
        'the call, and ask in your reply instead, when a REQUIRED field is missing or genuinely ' +
        'ambiguous. ' +
        'Some tools are consequential (e.g. booking/scheduling, placing an order) and the platform ' +
        'itself pauses and asks the user to explicitly confirm before they actually run — that ' +
        'confirmation step is handled entirely by the platform, not by you. So once you have enough ' +
        'information to attempt the action, CALL the tool immediately rather than asking "shall I ' +
        'proceed?" or "let me know if you want me to schedule this" in your reply — asking in text ' +
        'instead of calling the tool means the action never actually gets queued for confirmation. ' +
        'If a required field like a title is not given, use a sensible default (e.g. "Meeting") ' +
        'rather than withholding the call. ' +
        'The message gives you the current date/time — use it to resolve relative dates ' +
        '("today", "yesterday", "this morning") into actual yyyy-mm-dd values for any tool ' +
        'argument that takes a date. Never guess or invent a date.',
    },
    {
      role: 'user',
      content:
        `Current date/time (ISO): ${context.now}\n\n` +
        `Recent conversation:\n${renderRecentTurns(context.conversation.recentTurns)}\n\nIntent: ${intent}\nTools: ${JSON.stringify(catalog)}`,
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
