import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DomainEvent } from '@lifeos/contracts';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';
import { runMigrations } from '../src/shared/database/migrate.js';
import { SubscriberRegistry } from '../src/shared/events/subscribers/subscriber-registry.js';
import { DedupeStore } from '../src/shared/events/subscribers/dedupe.store.js';
import { IdempotentDispatcher } from '../src/shared/events/subscribers/idempotent-dispatcher.js';
import { ActivityRepository } from '../src/modules/activity/adapters/out/activity.repository.js';
import { ActivityEngine } from '../src/modules/activity/activity.engine.js';

const TEST_DB_URL = process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';

describe('Phase 19 — activity engine (integration)', () => {
  let db: PgDatabaseAdapter;
  let engine: ActivityEngine;
  let dispatcher: IdempotentDispatcher;
  const userId = randomUUID();

  beforeAll(async () => {
    await runMigrations(TEST_DB_URL);
    db = new PgDatabaseAdapter(TEST_DB_URL);
    const subscribers = new SubscriberRegistry();
    engine = new ActivityEngine(new ActivityRepository(db), subscribers);
    dispatcher = new IdempotentDispatcher(subscribers, new DedupeStore(db));

    engine.registerProjection({
      key: 'test.order_placed',
      on: 'test.order_placed',
      build: (event) => ({
        userId: event.userId!,
        kind: 'test.order_placed',
        title: 'Placed an order',
        summary: String((event.payload as { total: number }).total),
        occurredAt: event.occurredAt,
      }),
    });

    await db.query('insert into platform.users (id, email) values ($1, $2)', [
      userId,
      `act_${userId}@test.local`,
    ]);
  });

  afterAll(async () => {
    await db.query('delete from surface.activities where user_id = $1', [userId]);
    await db.query("delete from platform.processed_events where handler = 'activity:test.order_placed'");
    await db.query('delete from platform.users where id = $1', [userId]);
    await db.close();
  });

  it('projects an event into the feed, idempotently', async () => {
    const event: DomainEvent = {
      eventId: randomUUID(),
      type: 'test.order_placed',
      userId,
      occurredAt: new Date().toISOString(),
      payload: { total: 420 },
    };
    await dispatcher.dispatch(event);
    await dispatcher.dispatch(event); // at-least-once redelivery

    const feed = await engine.getFeed(userId);
    expect(feed.data).toHaveLength(1); // dedupe → single activity
    expect(feed.data[0]).toMatchObject({ kind: 'test.order_placed', title: 'Placed an order', summary: '420' });
  });

  it('paginates the feed (keyset)', async () => {
    for (let i = 0; i < 2; i += 1) {
      await dispatcher.dispatch({
        eventId: randomUUID(),
        type: 'test.order_placed',
        userId,
        occurredAt: new Date(Date.now() + i * 1000).toISOString(),
        payload: { total: i },
      });
    }
    const first = await engine.getFeed(userId, { limit: 1 });
    expect(first.data).toHaveLength(1);
    expect(first.nextCursor).toBeDefined();
    const second = await engine.getFeed(userId, { limit: 1, cursor: first.nextCursor });
    expect(second.data[0]?.id).not.toBe(first.data[0]?.id);
  });
});
