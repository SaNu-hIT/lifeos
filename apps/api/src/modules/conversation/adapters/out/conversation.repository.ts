import type { DomainEvent, Turn } from '@lifeos/contracts';
import type { DatabasePort } from '../../../../shared/database/database.port.js';
import type { EventBusPort } from '../../../../shared/events/event-bus.port.js';
import type { Message, NewMessage, Page, PageQuery } from '../../domain/ports/conversation.port.js';

interface MessageRow {
  id: string;
  conversation_id: string;
  role: Message['role'];
  content: unknown;
  turn_id: string | null;
  created_at: string;
}

function iso(value: string | Date): string {
  return new Date(value).toISOString();
}
function encodeCursor(createdAt: string | Date, id: string): string {
  return Buffer.from(`${iso(createdAt)}|${id}`).toString('base64url');
}
function decodeCursor(cursor: string): { createdAt: string; id: string } {
  const [createdAt, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  return { createdAt: createdAt ?? '', id: id ?? '' };
}
function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object' && 'text' in content) {
    return String((content as { text: unknown }).text);
  }
  return JSON.stringify(content);
}

/** Persistence for conversations/messages. Writes run in USER context (RLS). Message
 *  appends publish a domain event in the SAME transaction via the outbox (ADR-0008). */
export class ConversationRepository {
  constructor(
    private readonly db: DatabasePort,
    private readonly events: EventBusPort,
  ) {}

  async createConversation(userId: string, title?: string): Promise<{ id: string }> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<{ id: string }>(
          'insert into conversation.conversations (user_id, title) values ($1, $2) returning id',
          [userId, title ?? null],
        );
        return { id: r.rows[0]!.id };
      },
      { as: 'user', userId },
    );
  }

  async appendMessage(input: NewMessage): Promise<Message> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<{ id: string; created_at: string }>(
          `insert into conversation.messages (conversation_id, user_id, role, content, turn_id)
           values ($1, $2, $3, $4, $5) returning id, created_at`,
          [input.conversationId, input.userId, input.role, JSON.stringify(input.content), input.turnId ?? null],
        );
        const { id, created_at: createdAt } = r.rows[0]!;
        await tx.query('update conversation.conversations set updated_at = now() where id = $1', [
          input.conversationId,
        ]);

        const event: DomainEvent = {
          eventId: id,
          type: 'conversation.message_appended',
          userId: input.userId,
          occurredAt: createdAt,
          payload: { conversationId: input.conversationId, role: input.role, turnId: input.turnId ?? null },
        };
        await this.events.publish([event], tx);

        return {
          id,
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          turnId: input.turnId,
          createdAt: iso(createdAt),
        };
      },
      { as: 'user', userId: input.userId },
    );
  }

  async history(userId: string, conversationId: string, page: PageQuery): Promise<Page<Message>> {
    const limit = Math.min(page.limit ?? 50, 100);
    const cursor = page.cursor ? decodeCursor(page.cursor) : undefined;
    return this.db.transaction(
      async (tx) => {
        const rows = await tx.query<MessageRow>(
          `select id, conversation_id, role, content, turn_id, created_at
             from conversation.messages
            where conversation_id = $1
              and ($2::timestamptz is null or (created_at, id) < ($2::timestamptz, $3::uuid))
            order by created_at desc, id desc
            limit $4`,
          [conversationId, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
        );
        const hasMore = rows.rows.length > limit;
        const slice = rows.rows.slice(0, limit);
        const last = slice[slice.length - 1];
        return {
          data: slice.map((m) => ({
            id: m.id,
            conversationId: m.conversation_id,
            role: m.role,
            content: m.content,
            turnId: m.turn_id ?? undefined,
            createdAt: iso(m.created_at),
          })),
          nextCursor: hasMore && last ? encodeCursor(last.created_at, last.id) : undefined,
        };
      },
      { as: 'user', userId },
    );
  }

  async recentTurns(conversationId: string, userId: string, limit: number): Promise<Turn[]> {
    return this.db.transaction(
      async (tx) => {
        const rows = await tx.query<MessageRow>(
          `select id, role, content, created_at from conversation.messages
            where conversation_id = $1
            order by created_at desc, id desc
            limit $2`,
          [conversationId, limit],
        );
        return rows.rows
          .reverse()
          .map((m) => ({ id: m.id, role: m.role, content: contentToText(m.content), createdAt: iso(m.created_at) }));
      },
      { as: 'user', userId },
    );
  }
}
