// Deterministic local provider for development and tests — no external API, no key.
// The real OpenAI/Claude adapters implement the same AIProviderPort and drop in via
// config (docs/adr/adr-0004-ai-no-business-logic.md). Deterministic so tests are stable.

import type {
  AIProviderPort,
  ChatMessage,
  Completion,
  CompletionDelta,
  CompletionRequest,
} from './provider.js';

const EMBED_DIM = 64;

/** Bag-of-words hashing into a fixed-dim, L2-normalized vector. Texts that share
 *  words get similar vectors, so cosine similarity is meaningful for tests. */
function embedOne(text: string): number[] {
  const vec = new Array<number>(EMBED_DIM).fill(0);
  for (const token of text.toLowerCase().split(/\W+/).filter(Boolean)) {
    let hash = 0;
    for (let i = 0; i < token.length; i += 1) hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
    const idx = hash % EMBED_DIM;
    vec[idx] = (vec[idx] ?? 0) + 1;
  }
  const norm = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

function lastUser(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]!.role === 'user') return messages[i]!.content;
  }
  return '';
}

// ── Deterministic local planner ──────────────────────────────────────────────
// The AIPlanner (apps/api) asks the provider to "Return ONLY JSON of the form
// {"steps":[...]}" over a tool catalog. The real OpenAI/Claude adapters answer that
// with genuine reasoning; for offline dev the local provider answers with a small,
// GENERIC heuristic — token overlap between the intent and each tool name — so the
// full orchestrator→planner→tool path runs without a key. No skill-specific logic.

const STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'for', 'my', 'me', 'please', 'i', 'want', 'need', 'can', 'you',
  'get', 'some', 'of', 'in', 'on', 'at', 'and', 'with', 'this', 'that',
]);

// Maps common request verbs to the tool-name tokens they imply.
const VERB_SYNONYMS: Record<string, string[]> = {
  search: ['search', 'find', 'look', 'browse'],
  order: ['order', 'buy', 'place', 'checkout', 'purchase'],
  cart: ['cart', 'add'],
  schedule: ['schedule', 'book'],
  list: ['list', 'show', 'view', 'upcoming'],
  confirmation: ['confirm', 'review'],
};

function tokens(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter((w) => w && !STOPWORDS.has(w));
}

function nameTokens(name: string): string[] {
  return name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

interface CatalogTool {
  name: string;
  inputSchema?: { properties?: Record<string, { type?: string }>; required?: string[] };
}

/** Detects the planner prompt and extracts the intent + tool catalog from it. */
function readPlannerRequest(
  messages: ChatMessage[],
): { intent: string; tools: CatalogTool[] } | null {
  const isPlanner = messages.some(
    (m) => m.role === 'system' && m.content.includes('"steps"'),
  );
  if (!isPlanner) return null;
  const user = lastUser(messages);
  const intentMatch = /Intent:\s*([\s\S]*?)\nTools:/.exec(user);
  const toolsMatch = /Tools:\s*([\s\S]*)$/.exec(user);
  if (!intentMatch || !toolsMatch) return null;
  try {
    const tools = JSON.parse(toolsMatch[1]!.trim()) as CatalogTool[];
    return { intent: intentMatch[1]!.trim(), tools: Array.isArray(tools) ? tools : [] };
  } catch {
    return null;
  }
}

/** Fill a value for a required arg, or return undefined if it can't be filled generically. */
function fillArg(propName: string, type: string | undefined, intentWords: string[]): unknown {
  if (type === 'string') {
    // Use the intent minus the leading verb as the phrase (e.g. "search milk" → "milk").
    const phrase = intentWords.slice(1).join(' ') || intentWords.join(' ');
    return phrase || propName;
  }
  if (type === 'integer' || type === 'number') {
    return /min|duration/i.test(propName) ? 30 : 1;
  }
  return undefined; // arrays/objects/etc. can't be synthesized from free text
}

/** Choose the best tool for an intent and build fillable args; null if nothing fits. */
function planFor(intent: string, tools: CatalogTool[]): { tool: string; args: unknown } | null {
  const intentWords = tokens(intent);
  const wordSet = new Set(intentWords);

  let best: { tool: CatalogTool; score: number } | null = null;
  for (const tool of tools) {
    const nts = nameTokens(tool.name);
    let score = 0;
    for (const nt of nts) {
      if (wordSet.has(nt)) score += 2;
      const syns = VERB_SYNONYMS[nt];
      if (syns && syns.some((s) => wordSet.has(s))) score += 2;
    }
    if (score > 0 && (!best || score > best.score)) best = { tool, score };
  }
  if (!best) return null;

  const required = best.tool.inputSchema?.required ?? [];
  const props = best.tool.inputSchema?.properties ?? {};
  const args: Record<string, unknown> = {};
  for (const key of required) {
    const value = fillArg(key, props[key]?.type, intentWords);
    if (value === undefined) return null; // can't satisfy this tool's contract generically
    args[key] = value;
  }
  return { tool: best.tool.name, args };
}

export class LocalAIProvider implements AIProviderPort {
  readonly name = 'local';

  async complete(request: CompletionRequest): Promise<Completion> {
    const planReq = readPlannerRequest(request.messages);
    if (planReq) {
      const step = planFor(planReq.intent, planReq.tools);
      const steps = step ? [step] : [];
      return { text: JSON.stringify({ steps }), model: 'local' };
    }
    return { text: `[local] ${lastUser(request.messages)}`.trim(), model: 'local' };
  }

  async *stream(request: CompletionRequest): AsyncIterable<CompletionDelta> {
    const { text } = await this.complete(request);
    for (const word of text.split(' ')) {
      yield { text: word + ' ' };
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(embedOne);
  }
}
