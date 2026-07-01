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

export class LocalAIProvider implements AIProviderPort {
  readonly name = 'local';

  async complete(request: CompletionRequest): Promise<Completion> {
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
