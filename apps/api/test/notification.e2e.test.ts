import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DomainEvent } from '@lifeos/contracts';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';
import { runMigrations } from '../src/shared/database/migrate.js';
import { SubscriberRegistry } from '../src/shared/events/subscribers/subscriber-registry.js';
import { DedupeStore } from '../src/shared/events/subscribers/dedupe.store.js';
import { IdempotentDispatcher } from '../src/shared/events/subscribers/idempotent-dispatcher.js';
import { NotificationRepository } from '../src/modules/notification/adapters/out/notification.repository.js';
import { NotificationPolicy } from '../src/modules/notification/domain/notification.policy.js';
import { NotificationEngine } from '../src/modules/notification/notification.engine.js';
import type {
  NotificationChannel,
  NotificationChannelName,
  NotificationView,
} from '../src/modules/notification/domain/ports/notification.port.js';

const TEST_DB_URL = process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';

class SpyChannel implements NotificationChannel {
  readonly delivered: NotificationView[] = [];
  constructor(readonly name: NotificationChannelName) {}
  async deliver(n: NotificationView): Promise<void> {
    this.delivered.push(n);
  }
}

describe('Phase 20 — notification engine (integration)', () => {
  let db: PgDatabaseAdapter;
  let engine: NotificationEngine;
  let dispatcher: IdempotentDispatcher;
  let push: SpyChannel;
  const userId = randomUUID();
  // Fixed clock at 12:00 UTC — outside any default quiet window.
  const clock = (): Date => new Date('2026-07-01T12:00:00.000Z');

  beforeAll(async () => {
    await runMigrations(TEST_DB_URL);
    db = new PgDatabaseAdapter(TEST_DB_URL);
    const subscribers = new SubscriberRegistry();
    push = new SpyChannel('push');
    engine = new NotificationEngine(
      new NotificationRepository(db),
      subscribers,
      new NotificationPolicy({ quietHours: { startHour: 22, endHour: 7 } }),
      [push],
      clock,
    );
    dispatcher = new IdempotentDispatcher(subscribers, new DedupeStore(db));

    engine.registerDeclaration({
      key: 'test.order_delivered',
      on: 'test.order_delivered',
      build: (event) => ({
        userId: event.userId!,
        kind: 'test.order_delivered',
        title: 'Your order arrived',
        importance: 'high',
        channels: ['in_app', 'push'],
        dedupeKey: (event.payload as { orderId: string }).orderId,
        occurredAt: event.occurredAt,
      }),
    });

    await db.query('insert into platform.users (id, email) values ($1, $2)', [
      userId,
      `ntf_${userId}@test.local`,
    ]);
  });

  afterAll(async () => {
    await db.query('delete from surface.notifications where user_id = $1', [userId]);
    await db.query(
      "delete from platform.processed_events where handler = 'notification:test.order_delivered'",
    );
    await db.query('delete from platform.users where id = $1', [userId]);
    await db.close();
  });

  it('declares → delivers to inbox + policy-selected channel, idempotently', async () => {
    const event: DomainEvent = {
      eventId: randomUUID(),
      type: 'test.order_delivered',
      userId,
      occurredAt: clock().toISOString(),
      payload: { orderId: 'order-1' },
    };
    await dispatcher.dispatch(event);
    await dispatcher.dispatch(event); // at-least-once redelivery

    const inbox = await engine.getInbox(userId);
    expect(inbox.data).toHaveLength(1); // dedupe → single notification
    expect(inbox.data[0]).toMatchObject({
      kind: 'test.order_delivered',
      title: 'Your order arrived',
      importance: 'high',
    });
    // External push fired exactly once (idempotent subscriber prevents re-delivery).
    expect(push.delivered).toHaveLength(1);
  });

  it('suppresses external channels below the importance floor (still stores in-app)', async () => {
    const before = push.delivered.length;
    const view = await engine.deliver({
      userId,
      kind: 'test.low',
      title: 'FYI',
      importance: 'low',
      channels: ['in_app', 'push'],
      occurredAt: clock().toISOString(),
    });
    expect(view).not.toBeNull();
    expect(push.delivered).toHaveLength(before); // low < normal floor → no push
  });

  it('dedupeKey suppresses a duplicate notification', async () => {
    const dup = await engine.deliver({
      userId,
      kind: 'test.order_delivered',
      title: 'Your order arrived (again)',
      importance: 'high',
      channels: ['in_app'],
      dedupeKey: 'order-1', // same logical thing as the first test
      occurredAt: clock().toISOString(),
    });
    expect(dup).toBeNull();
  });

  it('marks a notification read', async () => {
    const view = await engine.deliver({
      userId,
      kind: 'test.readable',
      title: 'Mark me',
      occurredAt: clock().toISOString(),
    });
    await engine.markRead(userId, view!.id);
    const inbox = await engine.getInbox(userId);
    const found = inbox.data.find((n) => n.id === view!.id);
    expect(found?.readAt).toBeDefined();
  });
});
