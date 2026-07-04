import { Module } from '@nestjs/common';
import type { AIProviderPort } from '@lifeos/ai-core';
import { PLANNER, type PlannerPort, TOOL_REGISTRY, type ToolRegistryPort } from '@lifeos/contracts';
import { AI_PROVIDER } from '../../shared/ai/ai-core.module.js';
import { loadAppConfig } from '../../config/app-config.js';
import { CONTEXT_ENGINE, type ContextEnginePort } from '../context/domain/ports/context-engine.port.js';
import { CONVERSATION, type ConversationPort } from '../conversation/domain/ports/conversation.port.js';
import { MEMORY, type MemoryPort } from '../memory/domain/ports/memory.port.js';
import { SubscriptionModule } from '../subscription/subscription.module.js';
import {
  PLAN_CAPABILITY_LOOKUP,
  type PlanCapabilityLookupPort,
} from '../subscription/domain/ports/plan-capability-lookup.port.js';
import { ORCHESTRATOR } from './domain/ports/orchestrator.port.js';
import { Orchestrator } from './orchestrator.js';
import { ConversationsController } from './adapters/in/conversations.controller.js';

@Module({
  imports: [SubscriptionModule],
  controllers: [ConversationsController],
  providers: [
    // PLANNER is provided globally by PlannerModule (phase-17).
    {
      provide: ORCHESTRATOR,
      useFactory: (
        conversation: ConversationPort,
        context: ContextEnginePort,
        tools: ToolRegistryPort,
        ai: AIProviderPort,
        memory: MemoryPort,
        planner: PlannerPort,
        plans: PlanCapabilityLookupPort,
      ) =>
        new Orchestrator(
          conversation,
          context,
          tools,
          ai,
          memory,
          planner,
          plans,
          loadAppConfig().UPGRADE_URL,
        ),
      inject: [
        CONVERSATION,
        CONTEXT_ENGINE,
        TOOL_REGISTRY,
        AI_PROVIDER,
        MEMORY,
        PLANNER,
        PLAN_CAPABILITY_LOOKUP,
      ],
    },
  ],
  exports: [ORCHESTRATOR],
})
export class OrchestratorModule {}
