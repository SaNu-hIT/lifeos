import { describe, expect, it } from 'vitest';
import { runSkillContractTests } from '@lifeos/skill-sdk';
import type { DomainEvent, Tool, UnifiedContext } from '@lifeos/contracts';
import {
  CALENDAR_EVENT_SCHEDULED,
  createCalendarSkill,
  findFreeSlot,
  overlaps,
  type CalendarEvent,
  type CalendarProviderPort,
  type CalendarRepositoryPort,
  type CreatedEvent,
} from '../src/index.js';

const NOW = '2026-07-01T08:00:00.000Z';

class InMemoryRepo implements CalendarRepositoryPort {
  readonly events: CalendarEvent[] = [];
  async saveEvent(event: CalendarEvent): Promise<void> {
    this.events.push(event);
  }
  async getEvent(userId: string, eventId: string): Promise<CalendarEvent | undefined> {
    return this.events.find((e) => e.userId === userId && e.id === eventId);
  }
  async upcomingEvents(userId: string, from: string, limit: number): Promise<CalendarEvent[]> {
    return this.events
      .filter((e) => e.userId === userId && new Date(e.startsAt) >= new Date(from))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, limit);
  }
}

class MockProvider implements CalendarProviderPort {
  readonly key = 'mock_calendar';
  readonly domain = 'calendar' as const;
  constructor(private readonly busy: CalendarEvent[] = []) {}
  async health() {
    return { healthy: true };
  }
  async listEvents(): Promise<CalendarEvent[]> {
    return this.busy;
  }
  async createEvent(userId: string): Promise<CreatedEvent> {
    return { providerEventId: `mock-${userId}` };
  }
}

function ctx(): UnifiedContext {
  return {
    user: { id: 'u1', locale: 'en-IN', timezone: 'Asia/Kolkata' },
    capabilities: ['calendar.read', 'calendar.write'],
    conversation: { id: 'c1', recentTurns: [] },
    memory: { facts: [], preferences: [], summaries: [] },
    settings: {},
    scope: 'calendar',
    now: NOW,
  };
}

function tool(tools: Tool[], name: string): Tool {
  const t = tools.find((x) => x.name === name);
  if (!t) throw new Error(`no such tool: ${name}`);
  return t;
}

function ev(id: string, startsAt: string, endsAt: string): CalendarEvent {
  return { id, userId: 'u1', title: id, startsAt, endsAt };
}

describe('calendar — pure scheduling', () => {
  it('detects overlap but treats touching edges as free', () => {
    const a = { startsAt: '2026-07-01T09:00:00Z', endsAt: '2026-07-01T10:00:00Z' };
    expect(overlaps(a, { startsAt: '2026-07-01T09:30:00Z', endsAt: '2026-07-01T10:30:00Z' })).toBe(true);
    expect(overlaps(a, { startsAt: '2026-07-01T10:00:00Z', endsAt: '2026-07-01T11:00:00Z' })).toBe(false);
  });

  it('finds the first gap that fits the duration', () => {
    const busy = [
      ev('m1', '2026-07-01T09:00:00Z', '2026-07-01T10:00:00Z'),
      ev('m2', '2026-07-01T10:15:00Z', '2026-07-01T11:00:00Z'),
    ];
    // 30-min slot between 08:00 window start and the 09:00 meeting.
    const slot = findFreeSlot(busy, '2026-07-01T08:00:00Z', '2026-07-01T17:00:00Z', 30);
    expect(slot?.startsAt).toBe('2026-07-01T08:00:00.000Z');
    // No 30-min gap between back-to-back meetings (09-10, 10:15-11): next fit is after 11:00.
    const tight = findFreeSlot(busy, '2026-07-01T10:00:00Z', '2026-07-01T17:00:00Z', 30);
    expect(tight?.startsAt).toBe('2026-07-01T11:00:00.000Z');
  });
});

describe('@lifeos/skill-calendar', () => {
  function setup(busy: CalendarEvent[] = []) {
    const repository = new InMemoryRepo();
    const provider = new MockProvider(busy);
    let seq = 0;
    const published: DomainEvent[] = [];
    const skill = createCalendarSkill({
      repository,
      provider,
      now: () => NOW,
      newId: () => `id-${(seq += 1)}`,
      publish: async (e) => {
        published.push(e);
      },
    });
    return { repository, skill, tools: skill.tools, published };
  }

  it('passes the skill contract kit', () => {
    expect(() => runSkillContractTests(setup().skill)).not.toThrow();
  });

  it('gates scheduling behind confirmation + calendar.write', () => {
    const { tools } = setup();
    const schedule = tool(tools, 'calendar.schedule_event');
    expect(schedule.requiresConfirmation).toBe(true);
    expect(schedule.requiredCapability).toBe('calendar.write');
    expect(tool(tools, 'calendar.list_events').requiredCapability).toBe('calendar.read');
  });

  it('finds a slot then schedules an event, persists it and publishes', async () => {
    const { tools, repository, published } = setup([
      ev('m1', '2026-07-01T09:00:00Z', '2026-07-01T10:00:00Z'),
    ]);
    const c = ctx();

    const { slot } = (await tool(tools, 'calendar.find_slot').handler(c, {
      windowStart: '2026-07-01T08:00:00Z',
      windowEnd: '2026-07-01T17:00:00Z',
      durationMinutes: 45,
    })) as { slot: { startsAt: string; endsAt: string } | null };
    expect(slot).not.toBeNull();

    const res = (await tool(tools, 'calendar.schedule_event').handler(c, {
      title: 'Dentist',
      startsAt: slot!.startsAt,
      endsAt: slot!.endsAt,
    })) as { eventId: string; providerEventId?: string };
    expect(res.eventId).toBe('id-1');
    expect(res.providerEventId).toBe('mock-u1');
    expect(repository.events).toHaveLength(1);
    expect(published.map((e) => e.type)).toEqual([CALENDAR_EVENT_SCHEDULED]);
  });

  it('rejects an event whose end is not after its start', async () => {
    const { tools } = setup();
    await expect(
      tool(tools, 'calendar.schedule_event').handler(ctx(), {
        title: 'Bad',
        startsAt: '2026-07-01T10:00:00Z',
        endsAt: '2026-07-01T10:00:00Z',
      }),
    ).rejects.toThrow(/end must be after/);
  });
});
