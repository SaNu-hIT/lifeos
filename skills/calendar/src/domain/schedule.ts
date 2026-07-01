// Pure scheduling logic — overlap detection and free-slot finding. No I/O and no
// clocks (the window is always passed in), so it is fully deterministic and testable.

import type { CalendarEvent, TimeSlot } from './types.js';

function ms(iso: string): number {
  return new Date(iso).getTime();
}

/** Do two intervals overlap? Touching edges (a.end === b.start) do NOT overlap. */
export function overlaps(a: TimeSlot, b: TimeSlot): boolean {
  return ms(a.startsAt) < ms(b.endsAt) && ms(b.startsAt) < ms(a.endsAt);
}

/**
 * First free slot of `durationMinutes` within [windowStart, windowEnd) that clears
 * all `busy` events. Returns null if the window can't fit the duration. `busy` need
 * not be sorted.
 */
export function findFreeSlot(
  busy: CalendarEvent[],
  windowStart: string,
  windowEnd: string,
  durationMinutes: number,
): TimeSlot | null {
  const durationMs = durationMinutes * 60_000;
  const windowEndMs = ms(windowEnd);
  const sorted = [...busy].sort((a, b) => ms(a.startsAt) - ms(b.startsAt));

  let cursor = ms(windowStart);
  for (const event of sorted) {
    const start = ms(event.startsAt);
    const end = ms(event.endsAt);
    if (end <= cursor) continue; // already behind the cursor
    if (start - cursor >= durationMs) {
      return { startsAt: new Date(cursor).toISOString(), endsAt: new Date(cursor + durationMs).toISOString() };
    }
    cursor = Math.max(cursor, end);
  }
  if (windowEndMs - cursor >= durationMs) {
    return { startsAt: new Date(cursor).toISOString(), endsAt: new Date(cursor + durationMs).toISOString() };
  }
  return null;
}
