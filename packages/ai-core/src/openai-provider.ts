// Real OpenAI adapter — no SDK dependency (repo convention: dependency-free HTTP,
// see shared/perf/runLoadTest). Talks to the Chat Completions + Embeddings REST API
// directly over `fetch`, with an injectable fetch implementation for tests.

import type {
  AIProviderPort,
  ChatMessage,
  Completion,
  CompletionDelta,
  CompletionRequest,
} from './provider.js';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_EMBED_MODEL = 'text-embedding-3-small';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

export interface OpenAIProviderOptions {
  apiKey: string;
  model?: string;
  embedModel?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface EmbeddingsResponse {
  data?: Array<{ embedding: number[] }>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export class OpenAIProvider implements AIProviderPort {
  readonly name = 'openai';
  private readonly model: string;
  private readonly embedModel: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OpenAIProviderOptions) {
    if (!options.apiKey) throw new AIProviderError('OpenAI provider requires an apiKey');
    this.model = options.model ?? DEFAULT_MODEL;
    this.embedModel = options.embedModel ?? DEFAULT_EMBED_MODEL;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: CompletionRequest): Promise<Completion> {
    const model = request.model ?? this.model;
    const body = await this.request<ChatCompletionResponse>('/chat/completions', {
      model,
      messages: toOpenAIMessages(request.messages),
      temperature: request.temperature,
    });
    const text = body.choices?.[0]?.message?.content ?? '';
    return { text, model };
  }

  async *stream(request: CompletionRequest): AsyncIterable<CompletionDelta> {
    const model = request.model ?? this.model;
    const res = await this.send('/chat/completions', {
      model,
      messages: toOpenAIMessages(request.messages),
      temperature: request.temperature,
      stream: true,
    });
    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const payload = line.trim();
        if (!payload.startsWith('data:')) continue;
        const data = payload.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const chunk = JSON.parse(data) as { choices?: [{ delta?: { content?: string } }] };
          const text = chunk.choices?.[0]?.delta?.content;
          if (text) yield { text };
        } catch {
          // Ignore malformed keep-alive/comment lines.
        }
      }
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const body = await this.request<EmbeddingsResponse>('/embeddings', {
      model: this.embedModel,
      input: texts,
    });
    return (body.data ?? []).map((d) => d.embedding);
  }

  private async request<T>(path: string, payload: Record<string, unknown>): Promise<T> {
    const res = await this.send(path, payload);
    return (await res.json()) as T;
  }

  /** Issues the HTTP call with a timeout and a small retry on 429/5xx. */
  private async send(path: string, payload: Record<string, unknown>): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${this.options.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) return res;
        if (!isRetryable(res.status) || attempt === MAX_RETRIES) {
          const detail = await safeText(res);
          throw new AIProviderError(`OpenAI request failed (${res.status}): ${detail}`, res.status);
        }
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
        if (err instanceof AIProviderError || attempt === MAX_RETRIES) throw err;
      }
      await sleep(2 ** attempt * 250);
    }
    throw lastError instanceof Error ? lastError : new AIProviderError('OpenAI request failed');
  }
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<no body>';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toOpenAIMessages(messages: ChatMessage[]): Array<{ role: string; content: string }> {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}
