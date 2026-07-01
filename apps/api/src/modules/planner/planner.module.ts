import { Global, Module } from '@nestjs/common';
import type { AIProviderPort } from '@lifeos/ai-core';
import { PLANNER } from '@lifeos/contracts';
import { AI_PROVIDER } from '../../shared/ai/ai-core.module.js';
import { AIPlanner } from './ai-planner.js';

@Global()
@Module({
  providers: [
    { provide: PLANNER, useFactory: (ai: AIProviderPort) => new AIPlanner(ai), inject: [AI_PROVIDER] },
  ],
  exports: [PLANNER],
})
export class PlannerModule {}
