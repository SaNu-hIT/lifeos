import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  CapabilityKey,
  DomainEvent,
  PermissionDecision,
  PermissionPort,
  SkillDescriptor,
  SkillManifest,
  SkillRegistryPort,
} from '@lifeos/contracts';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';
import { runMigrations } from '../src/shared/database/migrate.js';
import { SubscriberRegistry } from '../src/shared/events/subscribers/subscriber-registry.js';
import { DedupeStore } from '../src/shared/events/subscribers/dedupe.store.js';
import { IdempotentDispatcher } from '../src/shared/events/subscribers/idempotent-dispatcher.js';
import { ActivityRepository } from '../src/modules/activity/adapters/out/activity.repository.js';
import { ActivityEngine } from '../src/modules/activity/activity.engine.js';
import { NotificationRepository } from '../src/modules/notification/adapters/out/notification.repository.js';
import { NotificationPolicy } from '../src/modules/notification/domain/notification.policy.js';
import { NotificationEngine } from '../src/modules/notification/notification.engine.js';
import { WidgetInstanceRepository } from '../src/modules/home/adapters/out/widget-instance.repository.js';
import { HomeEngine } from '../src/modules/home/home.engine.js';
import { ContextProviderRegistry } from '../src/modules/context/context-provider-registry.js';
import { SkillHost } from '../src/modules/skill-host/skill-host.js';

const TEST_DB_URL = process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';

/** Records registered manifests; the host must call register() before wiring. */
class RecordingSkillRegistry implements SkillRegistryPort {
  readonly registered: string[] = [];
  async register(manifest: SkillManifest): Promise<void> {
    this.registered.push(manifest.key);
  }
  list(): SkillDescriptor[] {
    return [];
  }
  get(): SkillDescriptor | undefined {
    return undefined;
  }
  async setEnabled(): Promise<void> {}
}

class StubPermissions implements PermissionPort {
  constructor(private readonly granted: Set<string>) {}
  async can(_userId: string, capability: CapabilityKey): Promise<PermissionDecision> {
    return { allow: this.granted.has(capability) };
  }
  async capabilitiesFor(): Promise<CapabilityKey[]> {
    return [...this.granted] as CapabilityKey[];
  }
}

describe('Phase 22 — skill host (integration)', () => {
  let db: PgDatabaseAdapter;
  let dispatcher: IdempotentDispatcher;
  let activity: ActivityEngine;
  let notifications: NotificationEngine;
  let home: HomeEngine;
  let registry: RecordingSkillRegistry;
  let handledEvents = 0;
  const userId = randomUUID();
  const clock = (): Date => new Date('2026-07-01T12:00:00.000Z');

  beforeAll(async () => {
    await runMigrations(TEST_DB_URL);
    db = new PgDatabaseAdapter(TEST_DB_URL);
    const subscribers = new SubscriberRegistry();
    dispatcher = new IdempotentDispatcher(subscribers, new DedupeStore(db));
    activity = new ActivityEngine(new ActivityRepository(db), subscribers);
    notifications = new NotificationEngine(
      new NotificationRepository(db),
      subscribers,
      new NotificationPolicy(),
      [],
      clock,
    );
    home = new HomeEngine(new StubPermissions(new Set(['sample.use'])), new WidgetInstanceRepository(db));
    const context = new ContextProviderRegistry();
    registry = new RecordingSkillRegistry();

    const host = new SkillHost(registry, activity, notifications, home, context, subscribers);

    // A full-surface manifest — one install must wire every engine.
    const manifest: SkillManifest = {
      key: 'sample',
      version: '1.1.0',
      contractVersion: '^0.9.0',
      capabilities: [{ key: 'sample.use', description: 'Use the sample skill' }],
      tools: [],
      activityProjections: [
        {
          key: 'sample.echoed',
          on: 'sample.echoed',
          build: (event: DomainEvent) => ({
            userId: event.userId!,
            kind: 'sample.echoed',
            title: 'Echoed a message',
            occurredAt: event.occurredAt,
          }),
        },
      ],
      notifications: [
        {
          key: 'sample.echoed',
          on: 'sample.echoed',
          build: (event: DomainEvent) => ({
            userId: event.userId!,
            kind: 'sample.echoed',
            title: 'Your echo is ready',
            channels: ['in_app'],
            occurredAt: event.occurredAt,
          }),
        },
      ],
      widgets: [
        {
          key: 'sample.hello',
          title: 'Hello',
          requiredCapability: 'sample.use',
          priority: 1,
          build: async () => ({ props: { message: 'installed' } }),
        },
      ],
      eventHandlers: [
        {
          event: 'sample.echoed',
          handler: async () => {
            handledEvents += 1;
          },
        },
      ],
    };

    await host.install(manifest);
    await db.query('insert into platform.users (id, email) values ($1, $2)', [
      userId,
      `host_${userId}@test.local`,
    ]);
  });

  afterAll(async () => {
    await db.query('delete from surface.activities where user_id = $1', [userId]);
    await db.query('delete from surface.notifications where user_id = $1', [userId]);
    await db.query("delete from platform.processed_events where handler like 'activity:sample.%'");
    await db.query("delete from platform.processed_events where handler like 'notification:sample.%'");
    await db.query("delete from platform.processed_events where handler like 'skill:sample:%'");
    await db.query('delete from platform.users where id = $1', [userId]);
    await db.close();
  });

  it('registers the manifest before wiring contributions', () => {
    expect(registry.registered).toEqual(['sample']);
  });

  it('installs every contribution: one event fans out to activity + notification + handler', async () => {
    await dispatcher.dispatch({
      eventId: randomUUID(),
      type: 'sample.echoed',
      userId,
      occurredAt: clock().toISOString(),
      payload: { text: 'hi' },
    });

    const feed = await activity.getFeed(userId);
    expect(feed.data.map((a) => a.kind)).toContain('sample.echoed');

    const inbox = await notifications.getInbox(userId);
    expect(inbox.data.map((n) => n.kind)).toContain('sample.echoed');

    expect(handledEvents).toBe(1); // the raw event handler also fired
  });

  it('installs the home widget (capability-gated, now visible)', async () => {
    const view = await home.getHome(userId);
    expect(view.widgets.map((w) => w.key)).toContain('sample.hello');
  });
});
