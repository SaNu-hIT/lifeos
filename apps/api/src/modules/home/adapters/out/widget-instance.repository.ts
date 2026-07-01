import type { DatabasePort } from '../../../../shared/database/database.port.js';
import type { WidgetPreference } from '../../domain/ports/home.port.js';

export interface WidgetInstance {
  widgetKey: string;
  hidden: boolean;
  pinned: boolean;
  sortOverride: number | null;
}

interface WidgetInstanceRow {
  widget_key: string;
  hidden: boolean;
  pinned: boolean;
  sort_override: number | null;
}

export class WidgetInstanceRepository {
  constructor(private readonly db: DatabasePort) {}

  /** All of the user's widget overrides, keyed by widget key (user-context RLS). */
  async forUser(userId: string): Promise<Map<string, WidgetInstance>> {
    const res = await this.db.transaction(
      (tx) =>
        tx.query<WidgetInstanceRow>(
          `select widget_key, hidden, pinned, sort_override
             from surface.widget_instances`,
        ),
      { as: 'user', userId },
    );
    return new Map(
      res.rows.map((r) => [
        r.widget_key,
        { widgetKey: r.widget_key, hidden: r.hidden, pinned: r.pinned, sortOverride: r.sort_override },
      ]),
    );
  }

  /** Upsert one widget's preference (user-context RLS). Only provided fields change. */
  async upsert(userId: string, widgetKey: string, pref: WidgetPreference): Promise<void> {
    await this.db.transaction(
      (tx) =>
        tx.query(
          `insert into surface.widget_instances (user_id, widget_key, hidden, pinned, sort_override, updated_at)
             values ($1, $2, coalesce($3, false), coalesce($4, false), $5, now())
           on conflict (user_id, widget_key) do update set
             hidden        = coalesce($3, surface.widget_instances.hidden),
             pinned        = coalesce($4, surface.widget_instances.pinned),
             sort_override = coalesce($5, surface.widget_instances.sort_override),
             updated_at    = now()`,
          [
            userId,
            widgetKey,
            pref.hidden ?? null,
            pref.pinned ?? null,
            pref.sortOverride ?? null,
          ],
        ),
      { as: 'user', userId },
    );
  }
}
