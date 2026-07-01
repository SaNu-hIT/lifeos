// Domain contract-test kit for calendar connectors — verifies calendar-SHAPED
// behaviour beyond the base ProviderPort, so any connector is interchangeable (ADR-0005).

import type { CalendarProviderPort } from './ports/calendar-provider.port.js';

export async function runCalendarProviderContractTests(
  provider: CalendarProviderPort,
): Promise<void> {
  const errors: string[] = [];
  if (provider.domain !== 'calendar') errors.push(`domain must be 'calendar', got '${provider.domain}'`);
  const health = await provider.health();
  if (typeof health.healthy !== 'boolean') errors.push('health() must return { healthy: boolean }');

  const from = '2026-07-01T00:00:00.000Z';
  const to = '2026-07-02T00:00:00.000Z';
  const events = await provider.listEvents('contract-user', from, to);
  if (!Array.isArray(events)) errors.push('listEvents() must return an array');

  const created = await provider.createEvent('contract-user', {
    id: 'probe',
    userId: 'contract-user',
    title: 'Probe',
    startsAt: '2026-07-01T09:00:00.000Z',
    endsAt: '2026-07-01T09:30:00.000Z',
  });
  if (typeof created.providerEventId !== 'string' || created.providerEventId.length === 0) {
    errors.push('createEvent() must return a non-empty providerEventId');
  }

  if (errors.length > 0) {
    throw new Error(`Calendar provider contract failed for "${provider.key}":\n- ${errors.join('\n- ')}`);
  }
}
