export interface DateRange {
  from: string;
  to: string;
}

const MS_DAY = 86_400_000;

function startOfUtcDay(iso: string): Date {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dayRange(base: Date, offsetDays: number): DateRange {
  const start = new Date(base.getTime() + offsetDays * MS_DAY);
  const end = new Date(start.getTime() + MS_DAY - 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** Resolve relative date phrases in a message into an ISO range for read tools. */
export function resolveDateRange(message: string, nowIso: string): DateRange {
  const lower = message.toLowerCase();
  const today = startOfUtcDay(nowIso);

  if (/\btomorrow\b/.test(lower)) return dayRange(today, 1);
  if (/\byesterday\b/.test(lower)) return dayRange(today, -1);
  if (/\btoday\b/.test(lower) || /\bthis morning\b/.test(lower) || /\btonight\b/.test(lower)) {
    return dayRange(today, 0);
  }
  if (/\bnext week\b/.test(lower)) return { from: dayRange(today, 7).from, to: dayRange(today, 13).to };
  if (/\bthis week\b/.test(lower)) return { from: today.toISOString(), to: dayRange(today, 6).to };

  // Default window for calendar-style queries: today through the next 7 days.
  return { from: today.toISOString(), to: dayRange(today, 7).to };
}

/** Lookback days implied by temporal words in a history/summary query. */
export function resolveLookbackDays(message: string): number {
  const lower = message.toLowerCase();
  if (/\byesterday\b/.test(lower)) return 1;
  if (/\blast week\b/.test(lower)) return 7;
  if (/\blast month\b/.test(lower)) return 30;
  return 14;
}
