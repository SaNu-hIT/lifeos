import type {
  NotificationChannelName,
  NotificationImportance,
  NotificationIntent,
} from './ports/notification.port.js';

const IMPORTANCE_RANK: Record<NotificationImportance, number> = {
  low: 0,
  normal: 1,
  high: 2,
  urgent: 3,
};

export interface NotificationPolicyConfig {
  /** Quiet window [startHour, endHour) in UTC hours; external channels are held
   *  during it unless the notification is above `quietHoursOverride`. */
  quietHours?: { startHour: number; endHour: number };
  /** Importance at or above this bypasses quiet hours. Default 'urgent'. */
  quietHoursOverride?: NotificationImportance;
  /** Minimum importance for external (push/email) delivery. Default 'normal'. */
  minImportanceForExternal?: NotificationImportance;
}

/** Decides which EXTERNAL channels actually fire (in-app inbox always persists).
 *  Pure + deterministic: `now` is injected so tests are hermetic. */
export class NotificationPolicy {
  constructor(private readonly config: NotificationPolicyConfig = {}) {}

  resolveExternalChannels(intent: NotificationIntent, now: Date): NotificationChannelName[] {
    const importance = intent.importance ?? 'normal';
    const requested = (intent.channels ?? []).filter((c) => c !== 'in_app');
    if (requested.length === 0) return [];

    const floor = this.config.minImportanceForExternal ?? 'normal';
    if (IMPORTANCE_RANK[importance] < IMPORTANCE_RANK[floor]) return [];

    if (this.isQuiet(now)) {
      const override = this.config.quietHoursOverride ?? 'urgent';
      if (IMPORTANCE_RANK[importance] < IMPORTANCE_RANK[override]) return [];
    }
    return requested;
  }

  private isQuiet(now: Date): boolean {
    const q = this.config.quietHours;
    if (!q) return false;
    const h = now.getUTCHours();
    // Handle windows that wrap past midnight (e.g. 22 → 7).
    return q.startHour <= q.endHour
      ? h >= q.startHour && h < q.endHour
      : h >= q.startHour || h < q.endHour;
  }
}
