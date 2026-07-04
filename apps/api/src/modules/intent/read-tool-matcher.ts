import type { Tool } from '@lifeos/contracts';
import { isReadTool } from './tool-classifier.js';

interface ReadBinding {
  /** At least one keyword must appear for this binding to match. */
  keywords: string[];
  toolNames: string[];
}

/** Domain keyword → read tool names. Order matters: first match wins. */
const READ_BINDINGS: ReadBinding[] = [
  {
    keywords: ['meeting', 'meetings', 'event', 'events', 'calendar'],
    toolNames: ['calendar.list_events'],
  },
  {
    keywords: ['free', 'slot'],
    toolNames: ['calendar.find_slot', 'calendar.list_events'],
  },
  {
    keywords: ['shopping list', 'grocery list', 'my list', 'on my list'],
    toolNames: ['grocery.get_list'],
  },
  {
    keywords: ['pantry', 'groceries'],
    toolNames: ['grocery.get_list'],
  },
  {
    keywords: ['next period', 'my period', 'cycle', 'period'],
    toolNames: ['wellness.get_history_summary'],
  },
  {
    keywords: ['reminder'],
    toolNames: ['wellness.list_reminders'],
  },
  {
    keywords: ['workout', 'exercise'],
    toolNames: ['workout.get_history_summary', 'workout.get_exercise_history'],
  },
  {
    keywords: ['habit', 'habits', 'streak'],
    toolNames: ['habit.list_habits', 'habit.get_summary'],
  },
  {
    keywords: ['spending', 'budget', 'transaction'],
    toolNames: ['finance.get_summary'],
  },
  {
    keywords: ['meal plan', 'week plan', 'nutrition'],
    toolNames: ['meal.get_week_plan', 'meal.get_nutrition_summary'],
  },
];

const READ_QUERY =
  /\b(any|what|when|show|list|do i have|how many|is there|are there|what's on|whats on|tell me)\b/i;

function normalized(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ');
}

/** Pick the best permitted read tool for a state-query message, if any. */
export function matchReadTool(message: string, tools: Tool[]): Tool | undefined {
  const readTools = tools.filter(isReadTool);
  if (readTools.length === 0) return undefined;

  const text = normalized(message);
  const byName = new Map(readTools.map((t) => [t.name, t]));

  for (const binding of READ_BINDINGS) {
    if (!binding.keywords.some((kw) => text.includes(kw))) continue;
    for (const name of binding.toolNames) {
      const tool = byName.get(name);
      if (tool) return tool;
    }
  }

  // Generic question + a read tool whose name/description mentions a token in the message.
  if (!READ_QUERY.test(message) && !message.trim().endsWith('?')) return undefined;

  const words = text.split(/\W+/).filter((w) => w.length > 2);
  let best: { tool: Tool; score: number } | undefined;
  for (const tool of readTools) {
    const hay = `${tool.name} ${tool.description ?? ''}`.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (hay.includes(w)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { tool, score };
  }
  return best?.tool;
}
