// Dynamic provider registry (mirrors the Connector Registry pattern, docs/02 §6):
// adapters register a factory under a name; createAIProvider looks it up by config.
// Any adapter — in this package or an external one — can add itself without touching
// createAIProvider's call sites.

import type { AIProviderPort } from './provider.js';

export interface AIProviderOptions {
  /** Selects the registered factory. 'local' (default) needs no credentials. */
  provider?: string;
  apiKey?: string;
  /** Chosen by config, never hardcoded by callers (docs/03 §6). */
  model?: string;
  embedModel?: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Test seam: inject a fetch implementation instead of the global one. */
  fetchImpl?: typeof fetch;
}

export type AIProviderFactory = (options: AIProviderOptions) => AIProviderPort;

const factories = new Map<string, AIProviderFactory>();

/** Registers an AI provider factory under `name`. Re-registering a name replaces it. */
export function registerAIProvider(name: string, factory: AIProviderFactory): void {
  factories.set(name, factory);
}

export function listAIProviders(): string[] {
  return [...factories.keys()];
}

/** Selects the AI provider by config, deferring to whatever factory is registered. */
export function createAIProvider(options: AIProviderOptions = {}): AIProviderPort {
  const name = options.provider ?? 'local';
  const factory = factories.get(name);
  if (!factory) {
    throw new Error(`unknown AI provider: ${name} (registered: ${listAIProviders().join(', ') || 'none'})`);
  }
  return factory(options);
}
