import type { Turn } from '@lifeos/contracts';

/** Supplies recent conversation turns. A null reader is used until the Conversation
 *  Engine (phase-15) provides a real one. */
export const CONVERSATION_READER = Symbol('CONVERSATION_READER');
export interface ConversationReaderPort {
  recent(conversationId: string, userId: string, limit?: number): Promise<Turn[]>;
}
export class NullConversationReader implements ConversationReaderPort {
  async recent(): Promise<Turn[]> {
    return [];
  }
}

/** Supplies user settings. Empty until a Settings store is added. */
export const SETTINGS_READER = Symbol('SETTINGS_READER');
export interface SettingsReaderPort {
  get(userId: string): Promise<Record<string, unknown>>;
}
export class NullSettingsReader implements SettingsReaderPort {
  async get(): Promise<Record<string, unknown>> {
    return {};
  }
}
