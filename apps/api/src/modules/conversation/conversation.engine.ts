import type { Turn } from '@lifeos/contracts';
import type {
  ConversationPort,
  Message,
  NewMessage,
  Page,
  PageQuery,
} from './domain/ports/conversation.port.js';
import type { ConversationReaderPort } from '../context/domain/ports/readers.js';
import type { ConversationRepository } from './adapters/out/conversation.repository.js';

/** Conversation Engine. Also implements ConversationReaderPort so the Context Engine
 *  (phase-13) gets real recent turns. */
export class ConversationEngine implements ConversationPort, ConversationReaderPort {
  constructor(private readonly repo: ConversationRepository) {}

  start(userId: string, title?: string): Promise<{ id: string }> {
    return this.repo.createConversation(userId, title);
  }

  appendMessage(input: NewMessage): Promise<Message> {
    return this.repo.appendMessage(input);
  }

  history(userId: string, conversationId: string, page: PageQuery): Promise<Page<Message>> {
    return this.repo.history(userId, conversationId, page);
  }

  recentTurns(conversationId: string, userId: string, limit = 20): Promise<Turn[]> {
    return this.repo.recentTurns(conversationId, userId, limit);
  }

  // ConversationReaderPort
  recent(conversationId: string, userId: string, limit = 20): Promise<Turn[]> {
    return this.repo.recentTurns(conversationId, userId, limit);
  }
}
