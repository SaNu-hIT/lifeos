import { Global, Module } from '@nestjs/common';
import type { AIProviderPort } from '@lifeos/ai-core';
import { DATABASE, type DatabasePort } from '../../shared/database/database.port.js';
import { AI_PROVIDER } from '../../shared/ai/ai-core.module.js';
import { MEMORY } from './domain/ports/memory.port.js';
import { MemoryRepository } from './adapters/out/memory.repository.js';
import { MemoryEngine } from './memory.engine.js';

@Global()
@Module({
  providers: [
    {
      provide: MemoryRepository,
      useFactory: (db: DatabasePort) => new MemoryRepository(db),
      inject: [DATABASE],
    },
    {
      provide: MEMORY,
      useFactory: (repo: MemoryRepository, ai: AIProviderPort) => new MemoryEngine(repo, ai),
      inject: [MemoryRepository, AI_PROVIDER],
    },
  ],
  exports: [MEMORY],
})
export class MemoryModule {}
