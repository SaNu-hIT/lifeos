import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import type { DomainEvent } from '@lifeos/contracts';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';
import { runMigrations } from '../src/shared/database/migrate.js';
import { OutboxRepository } from '../src/shared/events/outbox/outbox.repository.js';
import { OutboxRelay } from '../src/shared/events/outbox/outbox-relay.js';
import { PgEventBus } from '../src/shared/events/pg-event-bus.js';
import { SubscriberRegistry } from '../src/shared/events/subscribers/subscriber-registry.js';
import { DedupeStore } from '../src/shared/events/subscribers/dedupe.store.js';
import { IdempotentDispatcher } from '../src/shared/events/subscribers/idempotent-dispatcher.js';
import { EventQueue } from '../src/shared/events/bullmq/event-queue.js';
import { EventWorker } from '../src/shared/events/bullmq/event-worker.js';

const TEST_DB_URL =
  process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

async function ensureDatabase(url: string): Promise<void> {
  const parsed = new URL(url);
  const dbName = parsed.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('select 1 from pg_database where datname = $1', [dbName]);
    if (!rowCount) await client.query(`create database ${dbName}`);
  } finally {
    await client.end();
  }
}

function makeEvent(type: string, payload: unknown = {}): DomainEvent {
  return { eventId: randomUUID(), type, occurredAt: new Date().toISOString(), payload };
}

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition');
    await new Promise((r) => setTimeout(r, 25));
  }
}

describe('Phase 06 — event bus + outbox + BullMQ (integration)', () => {
  let db: PgDatabaseAdapter;
  let outbox: OutboxRepository;
  let bus: PgEventBus;
  let queue: EventQueue;
  let relay: OutboxRelay;
  let registry: SubscriberRegistry;
  let dispatcher: IdempotentDispatcher;

  beforeAll(async () => {
    await ensureDatabase(TEST_DB_URL);
    await runMigrations(TEST_DB_URL);
    db = new PgDatabaseAdapter(TEST_DB_URL);
    outbox = new OutboxRepository(db);
    bus = new PgEventBus(outbox);
    queue = new EventQueue(REDIS_URL);
    relay = new OutboxRelay(outbox, queue);
    registry = new SubscriberRegistry();
    dispatcher = new IdempotentDispatcher(registry, new DedupeStore(db));
  });

  afterAll(async () => {
    await db.query("delete from platform.outbox where aggregate = 'test'");
    await db.query("delete from platform.processed_events where handler like 'test-%'");
    await queue.close();
    await db.close();
  });

  it('outbox write is atomic with the transaction (rollback ⇒ no row)', async () => {
    const event = makeEvent('test.rolled_back');
    await expect(
      db.transaction(async (tx) => {
        await bus.publish([event], tx);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const row = await db.query('select 1 from platform.outbox where id = $1', [event.eventId]);
    expect(row.rowCount).toBe(0);
  });

  it('relay moves a committed event to the queue and marks it published', async () => {
    const event = makeEvent('test.committed');
    await db.transaction((tx) => bus.publish([event], tx));

    const before = await db.query<{ published_at: string | null }>(
      'select published_at from platform.outbox where id = $1',
      [event.eventId],
    );
    expect(before.rows[0]!.published_at).toBeNull();

    const moved = await relay.runOnce();
    expect(moved).toBeGreaterThanOrEqual(1);

    const after = await db.query<{ published_at: string | null }>(
      'select published_at from platform.outbox where id = $1',
      [event.eventId],
    );
    expect(after.rows[0]!.published_at).not.toBeNull();
  });

  it('dispatch is idempotent (same event twice ⇒ handler runs once)', async () => {
    let count = 0;
    registry.on('test.dispatch_once', 'test-counter', async () => {
      count += 1;
    });
    const event = makeEvent('test.dispatch_once');
    await dispatcher.dispatch(event);
    await dispatcher.dispatch(event);
    expect(count).toBe(1);
  });

  it('end-to-end: published event reaches a subscriber via BullMQ', async () => {
    const seen: string[] = [];
    registry.on('test.e2e_event', 'test-recorder', async (event) => {
      seen.push(event.eventId);
    });
    const worker = new EventWorker(REDIS_URL, (event) => dispatcher.dispatch(event));
    try {
      const event = makeEvent('test.e2e_event');
      await db.transaction((tx) => bus.publish([event], tx));
      await relay.runOnce();
      await waitFor(() => seen.includes(event.eventId));
      expect(seen).toContain(event.eventId);
    } finally {
      await worker.close();
    }
  });
});
