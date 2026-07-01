import { describe, expect, it } from 'vitest';
import { runProviderContractTests } from '@lifeos/provider-sdk';
import { runCalendarProviderContractTests, type CalendarEvent } from '@lifeos/skill-calendar';
import { createGoogleCalendarConnector, googleCalendarConnector } from '../src/index.js';

function ev(id: string, startsAt: string, endsAt: string): CalendarEvent {
  return { id, userId: 'u1', title: id, startsAt, endsAt };
}

describe('@lifeos/connector-google-calendar', () => {
  it('satisfies the base ProviderPort contract', async () => {
    await expect(runProviderContractTests(googleCalendarConnector)).resolves.not.toThrow();
  });

  it('satisfies the calendar domain provider contract', async () => {
    await expect(runCalendarProviderContractTests(createGoogleCalendarConnector())).resolves.not.toThrow();
  });

  it('lists events overlapping the window and round-trips a created event', async () => {
    const c = createGoogleCalendarConnector([ev('m1', '2026-07-01T09:00:00Z', '2026-07-01T10:00:00Z')]);
    const before = await c.listEvents('u1', '2026-07-01T00:00:00Z', '2026-07-02T00:00:00Z');
    expect(before).toHaveLength(1);

    const created = await c.createEvent('u1', ev('m2', '2026-07-01T11:00:00Z', '2026-07-01T11:30:00Z'));
    expect(created.providerEventId).toMatch(/^gcal-u1-/);

    const after = await c.listEvents('u1', '2026-07-01T00:00:00Z', '2026-07-02T00:00:00Z');
    expect(after).toHaveLength(2);
  });
});
