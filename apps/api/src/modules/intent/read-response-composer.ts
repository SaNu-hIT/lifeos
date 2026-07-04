interface StepResult {
  tool: string;
  output?: unknown;
  error?: { code: string; message: string };
}

function toolLabel(tool: string): string {
  return (tool.split('.').pop() ?? tool).replace(/_/g, ' ');
}

function describeEvents(events: unknown[]): string {
  if (events.length === 0) return 'You have nothing scheduled in that window.';
  const lines = events.map((raw) => {
    const e = raw as { title?: string; startsAt?: string };
    const when = e.startsAt ? new Date(e.startsAt).toLocaleString() : '';
    return `• ${e.title ?? 'Event'}${when ? ` — ${when}` : ''}`;
  });
  return `You have ${events.length} event${events.length === 1 ? '' : 's'}:\n${lines.join('\n')}`;
}

function describeListItems(items: unknown[]): string {
  if (items.length === 0) return 'Your list is empty.';
  const names = items
    .map((it) => (it && typeof it === 'object' ? (it as { name?: string }).name : undefined))
    .filter((n): n is string => Boolean(n));
  if (names.length) return `On your list: ${names.join(', ')}.`;
  return `Your list has ${items.length} item${items.length === 1 ? '' : 's'}.`;
}

function describeOutput(tool: string, output: unknown): string {
  if (output === null || output === undefined) return 'Done.';
  if (typeof output !== 'object') return String(output);

  const obj = output as Record<string, unknown>;
  if (Array.isArray(obj.events)) return describeEvents(obj.events);
  if (Array.isArray(obj.items)) return describeListItems(obj.items);
  if (Array.isArray(obj.habits)) {
    if (obj.habits.length === 0) return 'You have no active habits.';
    return `You have ${obj.habits.length} active habit${obj.habits.length === 1 ? '' : 's'}.`;
  }
  if (obj.prediction && typeof obj.prediction === 'object') {
    const p = obj.prediction as { nextPeriodStart?: string };
    if (p.nextPeriodStart) {
      return `Based on your records, your next period is expected around ${new Date(p.nextPeriodStart).toLocaleDateString()}.`;
    }
  }
  if (obj.slot === null) return 'No free slot found in that window.';
  if (obj.slot && typeof obj.slot === 'object') {
    const s = obj.slot as { startsAt?: string; endsAt?: string };
    return `Found a free slot: ${s.startsAt ?? ''} – ${s.endsAt ?? ''}.`;
  }

  const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return 'Done.';
  return entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join('; ');
}

/** Compose a user-facing reply grounded ONLY in tool results — no conversation history. */
export function composeReadResponse(_userQuestion: string, results: StepResult[]): string {
  if (results.length === 0) {
    return "I couldn't retrieve that from your records — no read tool ran this turn.";
  }

  return results
    .map((r) =>
      r.error
        ? `I couldn't ${toolLabel(r.tool)}: ${r.error.message}`
        : describeOutput(r.tool, r.output),
    )
    .join('\n');
}

/** Reply when a read was required but no tool could be matched or executed. */
export function composeReadFailureResponse(): string {
  return "I need to check your records for that, but I couldn't run the right lookup. Try rephrasing or ask what I can help with.";
}

/** Reply when a write was attempted but nothing ran. */
export function composeWriteFailureResponse(): string {
  return "Nothing was saved or changed this turn. If you meant to log or schedule something, tell me the details and I'll try again.";
}
