import { Module } from '@nestjs/common';
import type { AIProviderPort } from '@lifeos/ai-core';
import { PLANNER, type PlannerPort, TOOL_REGISTRY, type ToolRegistryPort } from '@lifeos/contracts';
import { AI_PROVIDER } from '../../shared/ai/ai-core.module.js';
import { CONTEXT_ENGINE, type ContextEnginePort } from '../context/domain/ports/context-engine.port.js';
import { CONVERSATION, type ConversationPort } from '../conversation/domain/ports/conversation.port.js';
import { MEMORY, type MemoryPort } from '../memory/domain/ports/memory.port.js';
import { ORCHESTRATOR } from './domain/ports/orchestrator.port.js';
import { Orchestrator } from './orchestrator.js';
import { ConversationsController } from './adapters/in/conversations.controller.js';

@Module({
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
      ) => new Orchestrator(conversation, context, tools, ai, memory, planner),
      inject: [CONVERSATION, CONTEXT_ENGINE, TOOL_REGISTRY, AI_PROVIDER, MEMORY, PLANNER],
    },
  ],
  exports: [ORCHESTRATOR],
})
export class OrchestratorModule {}
