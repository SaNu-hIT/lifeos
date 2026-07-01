import { Global, Module } from '@nestjs/common';
import { PERMISSION_PORT, type PermissionPort } from '@lifeos/contracts';
import { DATABASE, type DatabasePort } from '../../shared/database/database.port.js';
import { CACHE, type CachePort } from '../../shared/cache/cache.port.js';
import { MEMORY, type MemoryPort } from '../memory/domain/ports/memory.port.js';
import { CONTEXT_ENGINE } from './domain/ports/context-engine.port.js';
import {
  CONVERSATION_READER,
  type ConversationReaderPort,
  NullSettingsReader,
  SETTINGS_READER,
  type SettingsReaderPort,
} from './domain/ports/readers.js';
import { UserReader } from './adapters/out/user-reader.js';
import { CONTEXT_PROVIDER_REGISTRY, ContextProviderRegistry } from './context-provider-registry.js';
import { ContextEngine } from './context.engine.js';

@Global()
@Module({
  providers: [
    { provide: CONTEXT_PROVIDER_REGISTRY, useClass: ContextProviderRegistry },
    { provide: UserReader, useFactory: (db: DatabasePort) => new UserReader(db), inject: [DATABASE] },
    // CONVERSATION_READER is provided globally by ConversationModule (phase-15).
    // Settings has no store yet, so a null reader is used.
    { provide: SETTINGS_READER, useClass: NullSettingsReader },
    {
      provide: CONTEXT_ENGINE,
      useFactory: (
        permissions: PermissionPort,
        memory: MemoryPort,
        users: UserReader,
        conversation: ConversationReaderPort,
        settings: SettingsReaderPort,
        providers: ContextProviderRegistry,
        cache: CachePort,
      ) => new ContextEngine(permissions, memory, users, conversation, settings, providers, cache),
      inject: [
        PERMISSION_PORT,
        MEMORY,
        UserReader,
        CONVERSATION_READER,
        SETTINGS_READER,
        CONTEXT_PROVIDER_REGISTRY,
        CACHE,
      ],
    },
  ],
  exports: [CONTEXT_ENGINE, CONTEXT_PROVIDER_REGISTRY],
})
export class ContextModule {}
