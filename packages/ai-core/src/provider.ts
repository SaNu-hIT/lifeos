// The LLM provider abstraction. Holds NO business logic (docs/adr/adr-0004-ai-no-
// business-logic.md). Only the Planner/Orchestrator/Memory call it; Skills never do.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface CompletionRequest {
  messages: ChatMessage[];
  /** Chosen by config, never hardcoded (docs/03 §6). */
  model?: string;
  temperature?: number;
}

export interface Completion {
  text: string;
  model: string;
}

export interface CompletionDelta {
  text: string;
}

export interface AIProviderPort {
  readonly name: string;
  complete(request: CompletionRequest): Promise<Completion>;
  stream(request: CompletionRequest): AsyncIterable<CompletionDelta>;
  /** Returns one embedding vector per input text. */
  embed(texts: string[]): Promise<number[][]>;
}
