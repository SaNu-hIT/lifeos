import { randomUUID } from 'node:crypto';
import type {
  AIProviderPort,
} from '@lifeos/ai-core';
import type { PlannerPort, ToolRegistryPort } from '@lifeos/contracts';
import { renderRecentTurns } from '../../shared/ai/render-conversation.js';
import type { ContextEnginePort } from '../context/domain/ports/context-engine.port.js';
import type { ConversationPort } from '../conversation/domain/ports/conversation.port.js';
import type { MemoryPort } from '../memory/domain/ports/memory.port.js';
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
            'asked to see the full comparison, so omitting entries is not a helpful summary.',
        },
        {
          role: 'user',
          content: `Recent conversation:\n${renderRecentTurns(ctx.conversation.recentTurns)}\n\n${renderSummaryInput(input.content, results)}`,
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
}

function renderSummaryInput(userContent: string, results: StepResult[]): string {
  if (results.length === 0) return userContent;
  return `${userContent} :: ${JSON.stringify(results)}`;
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
