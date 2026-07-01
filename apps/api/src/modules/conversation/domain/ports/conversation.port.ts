import type { Turn } from '@lifeos/contracts';

/** DI token for the ConversationPort. */
export const CONVERSATION = Symbol('CONVERSATION');

export type MessageRole = 'user' | 'assistant' | 'tool' | 'system';

export interface NewMessage {
  conversationId: string;
  userId: string;
  role: MessageRole;
  content: unknown;
  turnId?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: unknown;
  turnId?: string;
  createdAt: string;
}

export interface PageQuery {
  limit?: number;
  cursor?: string;
}

export interface Page<T> {
  data: T[];
  nextCursor?: string;
}

/** Owns conversations, messages, and turns (docs/02 §5). */
export interface ConversationPort {
  start(userId: string, title?: string): Promise<{ id: string }>;
  appendMessage(input: NewMessage): Promise<Message>;
  history(userId: string, conversationId: string, page: PageQuery): Promise<Page<Message>>;
  recentTurns(conversationId: string, userId: string, limit?: number): Promise<Turn[]>;
}
