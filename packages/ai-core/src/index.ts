// @lifeos/ai-core — provider-agnostic LLM abstraction (docs/02 §7, ADR-0004).

export * from './provider.js';
export { LocalAIProvider } from './local-provider.js';

import type { AIProviderPort } from './provider.js';
import { LocalAIProvider } from './local-provider.js';

export interface AIProviderOptions {
  /** 'local' (default) or a real provider (deferred — needs credentials). */
  provider?: string;
  apiKey?: string;
}

/** Selects the AI provider by config. The OpenAI/Claude adapters are added here. */
export function createAIProvider(options: AIProviderOptions = {}): AIProviderPort {
  switch (options.provider ?? 'local') {
    case 'local':
      return new LocalAIProvider();
    case 'openai':
      throw new Error('OpenAI provider not configured (deferred — set OPENAI_API_KEY)');
    default:
      throw new Error(`unknown AI provider: ${options.provider}`);
  }
}
