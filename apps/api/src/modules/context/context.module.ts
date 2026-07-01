import { Global, Module } from '@nestjs/common';
import { PERMISSION_PORT, type PermissionPort } from '@lifeos/contracts';
import { DATABASE, type DatabasePort } from '../../shared/database/database.port.js';
import { CACHE, type CachePort } from '../../shared/cache/cache.port.js';
import { MEMORY, type MemoryPort } from '../memory/domain/ports/memory.port.js';
import { CONTEXT_ENGINE } from './domain/ports/context-engine.port.js';
import {
  CONVERSATION_READER,
  type ConversationReaderPort,
  NullConversationReader,
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
    // Null readers until the Conversation Engine (phase-15) and a Settings store land.
    { provide: CONVERSATION_READER, useClass: NullConversationReader },
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
