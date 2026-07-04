// Pure reminder-due logic. Auto-supply reminders are computed reactively (on tool
// call / context read) rather than via a background scheduler — the platform has no
// cron/scheduled-event infrastructure today (documented v1 limitation, see plan).

import type { CyclePrediction, SupplyItem } from './types.js';

export interface DueSupplyReminder {
  item: SupplyItem;
  dueDate: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS);
}

function subDays(date: string, days: number): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - Math.round(days));
  return d.toISOString().slice(0, 10);
}

/** A supply item is due once `now` has reached (predictedNextStart - its lead time)
 *  but the predicted period hasn't started yet. */
export function dueSupplyReminders(
  supplyList: SupplyItem[],
  prediction: CyclePrediction | undefined,
  now: string,
): DueSupplyReminder[] {
  if (!prediction) return [];
  const today = now.slice(0, 10);
  if (today >= prediction.predictedNextStart) return [];

  return supplyList
    .map((item) => ({ item, dueDate: subDays(prediction.predictedNextStart, item.defaultReminderDaysBefore) }))
    .filter(({ dueDate }) => daysBetween(dueDate, today) >= 0);
}
