import { Global, Module } from '@nestjs/common';
import { DATABASE, type DatabasePort } from '../../shared/database/database.port.js';
import { EVENT_BUS, type EventBusPort } from '../../shared/events/event-bus.port.js';
import { CONVERSATION_READER } from '../context/domain/ports/readers.js';
import { CONVERSATION } from './domain/ports/conversation.port.js';
import { ConversationRepository } from './adapters/out/conversation.repository.js';
import { ConversationEngine } from './conversation.engine.js';

@Global()
@Module({
  providers: [
    {
      provide: ConversationRepository,
      useFactory: (db: DatabasePort, events: EventBusPort) => new ConversationRepository(db, events),
      inject: [DATABASE, EVENT_BUS],
    },
    { provide: CONVERSATION, useFactory: (repo: ConversationRepository) => new ConversationEngine(repo), inject: [ConversationRepository] },
    // The Conversation Engine is also the real ConversationReader for the Context Engine.
    { provide: CONVERSATION_READER, useExisting: CONVERSATION },
  ],
  exports: [CONVERSATION, CONVERSATION_READER],
})
export class ConversationModule {}
