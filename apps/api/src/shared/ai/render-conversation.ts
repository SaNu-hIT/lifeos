import type { Turn } from '@lifeos/contracts';

/**
 * Renders recent conversation turns (oldest first) as a compact transcript for
 * inclusion in AI prompts, so the Planner and the summarizer can see what already
 * happened in this conversation instead of treating every turn as stateless.
 */
export function renderRecentTurns(turns: Turn[]): string {
  if (turns.length === 0) return '(none)';
  return [...turns]
    .reverse()
    .map((t) => `${t.role}: ${t.content}`)
    .join('\n');
}
