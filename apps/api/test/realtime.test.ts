import { describe, expect, it, vi } from 'vitest';
import type { DomainEvent } from '@lifeos/contracts';
import { RealtimeHub, type RealtimeMessage } from '../src/modules/realtime/realtime.hub.js';
import { SubscriberRegistry } from '../src/shared/events/subscribers/subscriber-registry.js';
import { IdempotentDispatcher } from '../src/shared/events/subscribers/idempotent-dispatcher.js';
import type { DedupeStore } from '../src/shared/events/subscribers/dedupe.store.js';

function event(userId: string | undefined, type: string): DomainEvent {
  return { eventId: `e-${type}`, type, userId, occurredAt: '2026-07-01T12:00:00.000Z', payload: { n: 1 } };
}

describe('Phase 29 — RealtimeHub (unit)', () => {
  it('delivers an event only to the owning user', () => {
    const hub = new RealtimeHub();
    const alice: RealtimeMessage[] = [];
    const bob: RealtimeMessage[] = [];
    hub.subscribe('alice', (m) => alice.push(m));
    hub.subscribe('bob', (m) => bob.push(m));

    hub.publish(event('alice', 'grocery.order_placed'));

    expect(alice).toHaveLength(1);
    expect(alice[0]).toMatchObject({ type: 'grocery.order_placed', payload: { n: 1 } });
    expect(bob).toHaveLength(0); // isolation boundary is userId
  });

  it('stops delivering after unsubscribe and cleans up', () => {
    const hub = new RealtimeHub();
    const got: RealtimeMessage[] = [];
    const off = hub.subscribe('alice', (m) => got.push(m));
    expect(hub.connectionCount('alice')).toBe(1);
    off();
    expect(hub.connectionCount('alice')).toBe(0);
    hub.publish(event('alice', 'x.y'));
    expect(got).toHaveLength(0);
  });

  it('ignores user-less events and isolates a throwing listener', () => {
    const hub = new RealtimeHub();
    const good: RealtimeMessage[] = [];
    hub.subscribe('alice', () => {
      throw new Error('bad connection');
    });
    hub.subscribe('alice', (m) => good.push(m));
    expect(() => hub.publish(event(undefined, 'x.y'))).not.toThrow(); // no user → no-op
    hub.publish(event('alice', 'x.y'));
    expect(good).toHaveLength(1); // survived the throwing listener
  });
});

describe('Phase 29 — dispatcher tap feeds the hub', () => {
  const noopDedupe = {
    alreadyProcessed: vi.fn(async () => false),
    markProcessed: vi.fn(async () => {}),
  } as unknown as DedupeStore;

  it('fans every dispatched event to the connected user, live', async () => {
    const hub = new RealtimeHub();
    const dispatcher = new IdempotentDispatcher(new SubscriberRegistry(), noopDedupe);
    dispatcher.registerTap((e) => hub.publish(e));

    const received: RealtimeMessage[] = [];
    hub.subscribe('alice', (m) => received.push(m));

    await dispatcher.dispatch(event('alice', 'calendar.event_scheduled'));

    expect(received).toHaveLength(1);
    expect(received[0]?.type).toBe('calendar.event_scheduled');
  });
});
