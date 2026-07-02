// In-memory CalendarRepositoryPort for the composed dev server (data resets on restart).

import type { CalendarEvent, CalendarRepositoryPort } from '@lifeos/skill-calendar';

export class InMemoryCalendarRepository implements CalendarRepositoryPort {
  private readonly events: CalendarEvent[] = [];

  async saveEvent(event: CalendarEvent): Promise<void> {
    this.events.push(event);
  }
  async getEvent(userId: string, eventId: string): Promise<CalendarEvent | undefined> {
    return this.events.find((e) => e.userId === userId && e.id === eventId);
  }
  async upcomingEvents(userId: string, from: string, limit: number): Promise<CalendarEvent[]> {
    const fromMs = new Date(from).getTime();
    return this.events
      .filter((e) => e.userId === userId && new Date(e.startsAt).getTime() >= fromMs)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, limit);
  }
}
