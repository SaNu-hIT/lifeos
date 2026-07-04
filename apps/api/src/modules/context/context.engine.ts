import type { PermissionPort, UnifiedContext } from '@lifeos/contracts';
import type { CachePort } from '../../shared/cache/cache.port.js';
import type { MemoryPort } from '../memory/domain/ports/memory.port.js';
import type { AssembleInput, ContextEnginePort } from './domain/ports/context-engine.port.js';
import type { ConversationReaderPort, SettingsReaderPort } from './domain/ports/readers.js';
import type { UserReader } from './adapters/out/user-reader.js';
import type { ContextProviderRegistry } from './context-provider-registry.js';

const CACHE_TTL_SECONDS = 15;

/**
 * Assembles the Unified Context from Permissions + Memory + user + conversation +
 * settings, then composes Skill Context Providers. The result is permission-scoped
 * per user (capabilities reflect grants; memory is RLS-scoped) — the single data
 * boundary Skills consume (docs/adr/adr-0007-context-engine.md).
 */
export class ContextEngine implements ContextEnginePort {
  constructor(
    private readonly permissions: PermissionPort,
    private readonly memory: MemoryPort,
    private readonly users: UserReader,
    private readonly conversation: ConversationReaderPort,
    private readonly settings: SettingsReaderPort,
    private readonly providers: ContextProviderRegistry,
    private readonly cache: CachePort,
  ) {}

  private cacheKey(input: AssembleInput): string {
    return `ctx:${input.userId}:${input.conversationId}:${input.scope}:${input.intentHint ?? ''}`;
  }

  async assemble(input: AssembleInput): Promise<UnifiedContext> {
    const key = this.cacheKey(input);
    const cached = await this.cache.get(key);
    let context: UnifiedContext;

    if (cached !== null) {
      context = JSON.parse(cached) as UnifiedContext;
    } else {
      const [capabilities, user, memory, settings] = await Promise.all([
        this.permissions.capabilitiesFor(input.userId),
        this.users.get(input.userId),
        this.memory.retrieve(input.userId, { query: input.intentHint ?? '', scope: input.scope }),
        this.settings.get(input.userId),
      ]);

      context = {
        user,
        capabilities,
        conversation: { id: input.conversationId, recentTurns: [] },
        memory,
        settings,
        scope: input.scope,
        now: new Date().toISOString(),
      };

      for (const provider of this.providers.providersFor(input.scope)) {
        context = merge(context, await provider.contribute(input));
      }

      await this.cache.set(key, JSON.stringify(context), CACHE_TTL_SECONDS);
    }

    // Conversation turns are never served from cache — they change every message.
    const recentTurns = await this.conversation.recent(input.conversationId, input.userId);
    return {
      ...context,
      conversation: { id: input.conversationId, recentTurns },
      now: new Date().toISOString(),
    };
  }
}

/** Shallow-merge a provider's partial contribution into the assembled context. */
function merge(base: UnifiedContext, partial: Partial<UnifiedContext>): UnifiedContext {
  return {
    ...base,
    settings: { ...base.settings, ...(partial.settings ?? {}) },
    memory: partial.memory
      ? {
          facts: [...base.memory.facts, ...partial.memory.facts],
          preferences: [...base.memory.preferences, ...partial.memory.preferences],
          summaries: [...base.memory.summaries, ...partial.memory.summaries],
        }
      : base.memory,
  };
}
