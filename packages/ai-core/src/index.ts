// @lifeos/ai-core — provider-agnostic LLM abstraction (docs/02 §7, ADR-0004).

export * from './provider.js';
export { LocalAIProvider } from './local-provider.js';
export { OpenAIProvider, AIProviderError, type OpenAIProviderOptions } from './openai-provider.js';
export {
  registerAIProvider,
  listAIProviders,
  createAIProvider,
  type AIProviderOptions,
  type AIProviderFactory,
} from './registry.js';

import { registerAIProvider } from './registry.js';
import { LocalAIProvider } from './local-provider.js';
import { OpenAIProvider } from './openai-provider.js';

// Built-in providers. External packages can register more via `registerAIProvider`
// without ai-core knowing about them (same pattern as the Connector Registry).
registerAIProvider('local', () => new LocalAIProvider());
registerAIProvider(
  'openai',
  (options) =>
    new OpenAIProvider({
      apiKey: options.apiKey ?? '',
      model: options.model,
      embedModel: options.embedModel,
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    }),
);
