import { randomUUID } from 'node:crypto';
import type {
  AIProviderPort,
} from '@lifeos/ai-core';
import type { PlannerPort, Tool, ToolRegistryPort, UnifiedContext } from '@lifeos/contracts';
import { renderRecentTurns } from '../../shared/ai/render-conversation.js';
import type { ContextEnginePort } from '../context/domain/ports/context-engine.port.js';
import type { ConversationPort } from '../conversation/domain/ports/conversation.port.js';
import type { MemoryPort } from '../memory/domain/ports/memory.port.js';
import type { PlanCapabilityLookupPort } from '../subscription/domain/ports/plan-capability-lookup.port.js';
import type {
  ClarificationChoice,
  OrchestratorPort,
  PriceMatrix,
  SuggestedAction,
  TurnInput,
  TurnResult,
  TurnTrace,
} from './domain/ports/orchestrator.port.js';

interface StepResult {
  tool: string;
  output?: unknown;
  error?: { code: string; message: string };
}

/**
 * The canonical turn loop (docs/02 §6): persist the user message → assemble Context
 * → plan → execute tools (permission-checked, confirmation-aware) → summarize → persist
 * the reply → write memory. Holds NO business logic — it only sequences engines
 * (docs/adr/adr-0004-ai-no-business-logic.md).
 */
export class Orchestrator implements OrchestratorPort {
  constructor(
    private readonly conversation: ConversationPort,
    private readonly context: ContextEnginePort,
    private readonly tools: ToolRegistryPort,
    private readonly ai: AIProviderPort,
    private readonly memory: MemoryPort,
    private readonly planner: PlannerPort,
    private readonly plans: PlanCapabilityLookupPort,
    /** Informational upgrade/pricing link — no real payment processor is wired yet,
     *  so a locked-feature nudge only ever points here, never mutates a plan. */
    private readonly upgradeUrl: string,
  ) {}

  async handleTurn(input: TurnInput): Promise<TurnResult> {
    const turnId = randomUUID();
    const scope = input.scope ?? 'global';

    // 1. Persist the user message.
    await this.conversation.appendMessage({
      conversationId: input.conversationId,
      userId: input.userId,
      role: 'user',
      content: { text: input.content },
      turnId,
    });

    // 2. Assemble the permission-filtered Unified Context.
    const ctx = await this.context.assemble({
      userId: input.userId,
      conversationId: input.conversationId,
      scope,
      intentHint: input.content,
    });

    // 3. Plan over the tools the user is permitted to use.
    const availableTools = this.tools.list(ctx);
    const plan = await this.planner.plan({ intent: input.content, context: ctx, tools: availableTools });

    // A live trace of the pipeline, surfaced to the UI's execution log.
    const trace: TurnTrace = {
      scope,
      capabilities: ctx.capabilities,
      availableTools: availableTools.map((t) => t.name),
      plan: plan.steps.map((s) => ({ tool: s.tool, args: s.args })),
      steps: [],
    };

    // 4. Execute the plan.
    const results: StepResult[] = [];
    // Follow-up buttons are self-aware: they come ONLY from the tools that actually
    // ran this turn, each of which decides (from its own result) whether a next-step
    // button is still relevant. The Planner no longer injects buttons — that path had
    // no notion of "already done" and re-offered stale actions. Deduped by label.
    const suggestedActions: SuggestedAction[] = [];
    const addSuggestion = (s: SuggestedAction): void => {
      if (!suggestedActions.some((a) => a.label === s.label)) suggestedActions.push(s);
    };
    for (const step of plan.steps) {
      const confirmationToken =
        input.confirmation?.toolName === step.tool ? input.confirmation.token : undefined;
      // Resuming a paused clarification: merge the user's answers back into this
      // step's args so the tool can finish the same call instead of re-asking.
      const args =
        input.clarification?.toolName === step.tool
          ? { ...(step.args as Record<string, unknown>), selections: input.clarification.selections }
          : step.args;
      const res = await this.tools.execute(step.tool, ctx, args, { confirmationToken });
      if (res.status === 'needs_confirmation') {
        trace.steps.push({ tool: step.tool, status: 'needs_confirmation' });
        return {
          turnId,
          status: 'awaiting_confirmation',
          confirmation: { toolName: step.tool, token: res.confirmationToken },
          trace,
        };
      }
      if (res.status === 'needs_clarification') {
        trace.steps.push({ tool: step.tool, status: 'needs_clarification' });
        return {
          turnId,
          status: 'awaiting_clarification',
          clarification: { toolName: step.tool, choices: res.choices as ClarificationChoice[] },
          trace,
        };
      }
      if (res.status === 'error') {
        trace.steps.push({ tool: step.tool, status: 'error', error: res.error });
        results.push({ tool: step.tool, error: res.error });
        break; // abort the plan on the first error
      }
      trace.steps.push({ tool: step.tool, status: 'ok' });
      results.push({ tool: step.tool, output: res.output });
      // Collect the tool's next-step suggestions, deduped by label — a plan that adds
      // several items runs add_to_list multiple times but should offer "compare" once.
      for (const followUp of res.followUps ?? []) addSuggestion(followUp);
    }

    // 4.5. The plan came back empty — check whether the user's ask actually matches a
    // tool they don't have permission for yet, so we can nudge an upgrade instead of a
    // generic "I can't do that" reply. Only runs on this (minority) empty-plan path —
    // normal turns with a real plan pay zero extra cost.
    let lockedFeatureNote: string | undefined;
    let capabilitiesNote: string | undefined;
    if (plan.steps.length === 0) {
      lockedFeatureNote = await this.detectLockedIntent(input.content, ctx, addSuggestion);
      // No tool ran and no locked feature matched — the summarizer would otherwise have
      // zero grounding in what the platform can actually do (e.g. "what can you do?"),
      // so hand it the user's own permitted tool catalog to answer from.
      if (!lockedFeatureNote) {
        capabilitiesNote = renderCapabilitiesNote(availableTools);
      }
    }

    // 5. Summarize the outcome (the AI only summarizes; it holds no logic).
    const summary = await this.ai.complete({
      messages: [
        {
          role: 'system',
          content:
            'Summarize the outcome for the user. Use the recent conversation for context — ' +
            "don't ask the user to repeat information they already gave in an earlier turn. " +
            'If a tool result contains a breakdown across multiple stores/items (e.g. a price ' +
            'comparison), report every store/item found, not just the single cheapest — the user ' +
            'asked to see the full comparison, so omitting entries is not a helpful summary. ' +
            "If the message below includes a list of the user's available tools/capabilities, " +
            'and the user asked what the assistant can do (or something equivalent), answer from ' +
            'that list in plain language — describe the actual things they can ask for, grouped ' +
            'sensibly, not a vague generic answer. Never invent capabilities not in the list.',
        },
        {
          role: 'user',
          content:
            `Recent conversation:\n${renderRecentTurns(ctx.conversation.recentTurns)}\n\n` +
            `${renderSummaryInput(input.content, results)}` +
            (lockedFeatureNote ? `\n\n${lockedFeatureNote}` : '') +
            (capabilitiesNote ? `\n\n${capabilitiesNote}` : ''),
        },
      ],
    });

    // 6. Persist the assistant reply and write a turn summary to memory.
    await this.conversation.appendMessage({
      conversationId: input.conversationId,
      userId: input.userId,
      role: 'assistant',
      content: { text: summary.text },
      turnId,
    });
    await this.memory.writeSummary(input.userId, {
      conversationId: input.conversationId,
      summary: summary.text,
    });

    return {
      turnId,
      status: 'completed',
      assistantMessage: { content: summary.text, priceMatrix: extractPriceMatrix(results) },
      ...(suggestedActions.length > 0 ? { suggestedActions } : {}),
      trace,
    };
  }

  /**
   * Called only when the planner returned an empty plan. Checks whether the user's
   * message actually matches a tool they don't currently have permission for (rather
   * than being pure chit-chat), so the reply can explain it's a paid feature instead
   * of a generic "I'm not sure". A second, narrow LLM call — kept separate from the
   * planner so the planner's prompt/job stays unchanged on every ordinary turn, and
   * this only runs on the minority empty-plan path.
   */
  private async detectLockedIntent(
    content: string,
    ctx: UnifiedContext,
    addSuggestion: (s: SuggestedAction) => void,
  ): Promise<string | undefined> {
    const lockedTools = this.tools
      .listAll()
      .filter((tool) => !ctx.capabilities.includes(tool.requiredCapability));
    if (lockedTools.length === 0) return undefined;

    const { text } = await this.ai.complete({
      messages: [
        {
          role: 'system',
          content:
            'You classify whether a user message is asking to DO something that matches ' +
            'one of the LOCKED tools below (tools the user cannot currently use because they ' +
            'lack a paid capability). Return ONLY JSON: {"matched":true,"toolName":"<name>"} ' +
            'or {"matched":false} if the message is chit-chat, a question you cannot map to ' +
            'any tool, or does not concern one of these locked tools.',
        },
        {
          role: 'user',
          content: `Message: ${content}\nLocked tools: ${JSON.stringify(
            lockedTools.map((t) => ({ name: t.name, description: t.description, requiredCapability: t.requiredCapability })),
          )}`,
        },
      ],
    });
    const match = parseLockedMatch(text);
    if (!match?.matched) return undefined;

    const tool = lockedTools.find((t) => t.name === match.toolName);
    if (!tool) return undefined;

    const plans = await this.plans.plansGranting(tool.requiredCapability);
    addSuggestion({
      label: 'See upgrade options',
      prompt: 'What plans are available?',
      url: this.upgradeUrl,
    });

    const planNames = plans.map((p) => p.name).join(', ') || 'a paid plan';
    return (
      `[SYSTEM NOTE: the user's request needs "${tool.name}" (${tool.description ?? ''}), ` +
      `which is part of ${planNames}, not their current plan. Explain this briefly and ` +
      'mention they can see upgrade options — do not invent pricing or plan details ' +
      'beyond what is given here.]'
    );
  }
}

function renderSummaryInput(userContent: string, results: StepResult[]): string {
  if (results.length === 0) return userContent;
  return `${userContent} :: ${JSON.stringify(results)}`;
}

/** Lists the user's currently permitted tools (name + description) so the summarizer
 *  can ground a "what can you do?"-style reply in real capabilities instead of guessing. */
function renderCapabilitiesNote(availableTools: Tool[]): string | undefined {
  if (availableTools.length === 0) return undefined;
  const catalog = availableTools.map((t) => ({ name: t.name, description: t.description }));
  return `[SYSTEM NOTE: the user's available tools/capabilities are: ${JSON.stringify(catalog)}]`;
}

interface LockedMatch {
  matched: boolean;
  toolName?: string;
}

/** Extract the first JSON object from the model output, tolerating surrounding text —
 *  same tolerant-parse style as the planner's `parsePlan`. */
function parseLockedMatch(text: string): LockedMatch | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as { matched?: unknown; toolName?: unknown };
    if (typeof obj.matched === 'boolean') {
      return { matched: obj.matched, toolName: typeof obj.toolName === 'string' ? obj.toolName : undefined };
    }
  } catch {
    return null;
  }
  return null;
}

/** Surfaces a tool's structured price-comparison matrix (if any step produced one) so
 *  the UI can render a table instead of only the AI's prose summary. Generic over the
 *  tool name — any tool may return a `matrix` shaped this way. */
function extractPriceMatrix(results: StepResult[]): PriceMatrix | undefined {
  for (const r of results) {
    const out = r.output as { matrix?: PriceMatrix } | undefined;
    if (out && typeof out === 'object' && out.matrix && Array.isArray(out.matrix.products)) {
      return out.matrix;
    }
  }
  return undefined;
}
