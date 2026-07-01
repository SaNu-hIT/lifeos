import { randomUUID } from 'node:crypto';
import type {
  AIProviderPort,
} from '@lifeos/ai-core';
import type { PlannerPort, ToolRegistryPort } from '@lifeos/contracts';
import type { ContextEnginePort } from '../context/domain/ports/context-engine.port.js';
import type { ConversationPort } from '../conversation/domain/ports/conversation.port.js';
import type { MemoryPort } from '../memory/domain/ports/memory.port.js';
import type {
  OrchestratorPort,
  TurnInput,
  TurnResult,
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

    // 4. Execute the plan.
    const results: StepResult[] = [];
    for (const step of plan.steps) {
      const confirmationToken =
        input.confirmation?.toolName === step.tool ? input.confirmation.token : undefined;
      const res = await this.tools.execute(step.tool, ctx, step.args, { confirmationToken });
      if (res.status === 'needs_confirmation') {
        return {
          turnId,
          status: 'awaiting_confirmation',
          confirmation: { toolName: step.tool, token: res.confirmationToken },
        };
      }
      if (res.status === 'error') {
        results.push({ tool: step.tool, error: res.error });
        break; // abort the plan on the first error
      }
      results.push({ tool: step.tool, output: res.output });
    }

    // 5. Summarize the outcome (the AI only summarizes; it holds no logic).
    const summary = await this.ai.complete({
      messages: [
        { role: 'system', content: 'Summarize the outcome for the user.' },
        { role: 'user', content: renderSummaryInput(input.content, results) },
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

    return { turnId, status: 'completed', assistantMessage: { content: summary.text } };
  }
}

function renderSummaryInput(userContent: string, results: StepResult[]): string {
  if (results.length === 0) return userContent;
  return `${userContent} :: ${JSON.stringify(results)}`;
}
