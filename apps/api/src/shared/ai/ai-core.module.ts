import { Global, Module } from '@nestjs/common';
import { type AIProviderPort, createAIProvider } from '@lifeos/ai-core';
import { loadAppConfig } from '../../config/app-config.js';

/** DI token for the AI provider. Only the Planner/Orchestrator/Memory inject this;
 *  Skills never do (docs/adr/adr-0004-ai-no-business-logic.md). */
export const AI_PROVIDER = Symbol('AI_PROVIDER');

@Global()
@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      useFactory: (): AIProviderPort => {
        const config = loadAppConfig();
        return createAIProvider({
          provider: config.AI_PROVIDER,
          apiKey: config.OPENAI_API_KEY,
          model: config.OPENAI_MODEL,
          embedModel: config.OPENAI_EMBED_MODEL,
          timeoutMs: config.AI_REQUEST_TIMEOUT_MS,
        });
      },
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiCoreModule {}
