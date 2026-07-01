import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';
import { runMigrations } from '../src/shared/database/migrate.js';
import { OutboxRepository } from '../src/shared/events/outbox/outbox.repository.js';
import { PgEventBus } from '../src/shared/events/pg-event-bus.js';
import { ConversationRepository } from '../src/modules/conversation/adapters/out/conversation.repository.js';
import { ConversationEngine } from '../src/modules/conversation/conversation.engine.js';

const TEST_DB_URL = process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';

describe('Phase 15 — conversation engine (integration)', () => {
  let db: PgDatabaseAdapter;
  let conv: ConversationEngine;
  const userId = randomUUID();
  let conversationId: string;

  beforeAll(async () => {
    await runMigrations(TEST_DB_URL);
    db = new PgDatabaseAdapter(TEST_DB_URL);
    conv = new ConversationEngine(
      new ConversationRepository(db, new PgEventBus(new OutboxRepository(db))),
    );
    await db.query('insert into platform.users (id, email) values ($1, $2)', [
      userId,
      `conv_${userId}@test.local`,
    ]);
  });

  afterAll(async () => {
    await db.query("delete from platform.outbox where event_type = 'conversation.message_appended' and payload->>'conversationId' = $1", [conversationId]);
    await db.query('delete from conversation.messages where user_id = $1', [userId]);
    await db.query('delete from conversation.conversations where user_id = $1', [userId]);
    await db.query('delete from platform.users where id = $1', [userId]);
    await db.close();
  });

  it('starts a conversation and appends messages, emitting an outbox event', async () => {
    const started = await conv.start(userId, 'Groceries');
    conversationId = started.id;
    const turnId = randomUUID();

    const userMsg = await conv.appendMessage({
      conversationId,
      userId,
      role: 'user',
      content: { text: 'order coffee and milk' },
      turnId,
    });
    await conv.appendMessage({
      conversationId,
      userId,
      role: 'assistant',
      content: { text: 'Added coffee and milk. Confirm?' },
      turnId,
    });

    // The append published a domain event in the same transaction (outbox).
    const outbox = await db.query(
      "select 1 from platform.outbox where id = $1 and event_type = 'conversation.message_appended'",
      [userMsg.id],
    );
    expect(outbox.rowCount).toBe(1);
  });

  it('returns recent turns in chronological order (for the Context Engine)', async () => {
    const turns = await conv.recentTurns(conversationId, userId, 10);
    expect(turns.map((t) => t.role)).toEqual(['user', 'assistant']);
    expect(turns[0]?.content).toBe('order coffee and milk');
  });

  it('paginates history (keyset)', async () => {
    const firstPage = await conv.history(userId, conversationId, { limit: 1 });
    expect(firstPage.data).toHaveLength(1);
    expect(firstPage.nextCursor).toBeDefined();
    const secondPage = await conv.history(userId, conversationId, {
      limit: 1,
      cursor: firstPage.nextCursor,
    });
    expect(secondPage.data).toHaveLength(1);
    expect(secondPage.data[0]?.id).not.toBe(firstPage.data[0]?.id);
  });
});
