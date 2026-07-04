import type { Tool } from '@lifeos/contracts';

/** Infer whether a tool reads live Skill state (never mutates). */
export function isReadTool(tool: Tool): boolean {
  const verb = tool.name.split('.').pop() ?? '';
  if (/^(get_|list_|find_)/.test(verb)) return true;
  if (verb.endsWith('_summary') || verb === 'compare_prices' || verb === 'check_price') return true;
  return false;
}

/** Infer whether a tool mutates Skill state. */
export function isWriteTool(tool: Tool): boolean {
  if (tool.requiresConfirmation) return true;
  const verb = tool.name.split('.').pop() ?? '';
  return /^(add_|remove_|delete_|log_|save_|schedule_|create_|place_|set_|start_|finish_|cancel_|dismiss_|edit_|check_in|plan_|order)/.test(
    verb,
  );
}
