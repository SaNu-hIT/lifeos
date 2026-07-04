import type { Tool, UnifiedContext } from '@lifeos/contracts';
import type { IntentClassification, IntentKind } from './intent.types.js';
import { matchReadTool } from './read-tool-matcher.js';

const WRITE_PATTERN =
  /\b(add|schedule|log|delete|remove|set|create|save|place|order|buy|book|confirm|cancel|dismiss|start|finish|check in|check-in|track my|log my)\b/i;

const ANALYSIS_PATTERN =
  /\b(summarize|summarise|analyze|analyse|compare|breakdown|break down|how am i doing|how much did i spend)\b/i;

const CHAT_PATTERN =
  /^(hi|hello|hey|thanks|thank you|good morning|good evening|tell me a joke)\b/i;

const CAPABILITIES_PATTERN =
  /\b(what can you do|what all can i do|what can i do|what do you do|your capabilities|help me with)\b/i;

const READ_PATTERN =
  /\b(any|what|when|show|list|do i have|how many|is there|are there|what's on|whats on|tell me about my)\b/i;

/** Rule-based intent classification — deterministic, no LLM. */
export function classifyIntent(message: string, tools: Tool[], ctx: UnifiedContext): IntentClassification {
  const trimmed = message.trim();
  if (!trimmed) return { kind: 'chat' };

  if (CAPABILITIES_PATTERN.test(trimmed)) {
    return { kind: 'chat' };
  }

  if (CHAT_PATTERN.test(trimmed) && !READ_PATTERN.test(trimmed) && !WRITE_PATTERN.test(trimmed)) {
    return { kind: 'chat' };
  }

  if (ANALYSIS_PATTERN.test(trimmed)) {
    return { kind: 'analysis' };
  }

  if (WRITE_PATTERN.test(trimmed)) {
    return { kind: 'write' };
  }

  const readTool = matchReadTool(trimmed, tools);
  if (readTool) {
    return { kind: 'read', readTool };
  }

  if (READ_PATTERN.test(trimmed) || trimmed.endsWith('?')) {
    // State question with no matched read tool — still block history-only answers.
    return { kind: 'read' };
  }

  // Terse follow-ups after a domain discussion ("started today", "50 for lunch") → write.
  const recentDomain = inferRecentDomain(ctx);
  if (recentDomain && trimmed.split(/\s+/).length <= 6 && !trimmed.endsWith('?')) {
    return { kind: 'write' };
  }

  return { kind: 'chat' };
}

function inferRecentDomain(ctx: UnifiedContext): string | undefined {
  for (let i = ctx.conversation.recentTurns.length - 1; i >= 0; i -= 1) {
    const turn = ctx.conversation.recentTurns[i]!;
    const lower = turn.content.toLowerCase();
    if (lower.includes('period') || lower.includes('cycle') || lower.includes('flow')) return 'wellness';
    if (lower.includes('workout') || lower.includes('exercise') || lower.includes('set')) return 'workout';
    if (lower.includes('habit') || lower.includes('streak')) return 'habit';
    if (lower.includes('meeting') || lower.includes('calendar')) return 'calendar';
    if (lower.includes('grocery') || lower.includes('list') || lower.includes('milk')) return 'grocery';
    if (lower.includes('spent') || lower.includes('budget') || lower.includes('transaction')) return 'finance';
  }
  return undefined;
}

/** Whether this turn should bypass the intent router and use the planner directly. */
export function shouldUsePlanner(input: {
  confirmation?: unknown;
  clarification?: unknown;
}): boolean {
  return Boolean(input.confirmation || input.clarification);
}

export function intentKindLabel(kind: IntentKind): string {
  return kind;
}
