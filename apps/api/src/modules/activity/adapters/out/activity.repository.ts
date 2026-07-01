import type { DatabasePort } from '../../../../shared/database/database.port.js';
import type { ActivityEntry, ActivityPage, ActivityView } from '../../domain/ports/activity.port.js';

interface ActivityRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  summary: string | null;
  deep_link: string | null;
  occurred_at: string;
}

function iso(v: string | Date): string {
  return new Date(v).toISOString();
}
function encodeCursor(occurredAt: string | Date, id: string): string {
  return Buffer.from(`${iso(occurredAt)}|${id}`).toString('base64url');
}
function decodeCursor(cursor: string): { occurredAt: string; id: string } {
  const [occurredAt, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  return { occurredAt: occurredAt ?? '', id: id ?? '' };
}

export class ActivityRepository {
  constructor(private readonly db: DatabasePort) {}

  /** Insert a feed entry in SERVICE context (the projector is system-level). */
  async insert(entry: ActivityEntry): Promise<void> {
    await this.db.query(
      `insert into surface.activities (user_id, kind, title, summary, deep_link, occurred_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [entry.userId, entry.kind, entry.title, entry.summary ?? null, entry.deepLink ?? null, entry.occurredAt],
    );
  }

  /** Read the user's feed in USER context (RLS). */
  async feed(userId: string, limit: number, cursor?: string): Promise<ActivityPage> {
    const c = cursor ? decodeCursor(cursor) : undefined;
    return this.db.transaction(
      async (tx) => {
        const rows = await tx.query<ActivityRow>(
          `select id, user_id, kind, title, summary, deep_link, occurred_at
             from surface.activities
            where ($1::timestamptz is null or (occurred_at, id) < ($1::timestamptz, $2::uuid))
            order by occurred_at desc, id desc
            limit $3`,
          [c?.occurredAt ?? null, c?.id ?? null, limit + 1],
        );
        const hasMore = rows.rows.length > limit;
        const slice = rows.rows.slice(0, limit);
        const last = slice[slice.length - 1];
        return {
          data: slice.map(
            (r): ActivityView => ({
              id: r.id,
              userId: r.user_id,
              kind: r.kind,
              title: r.title,
              summary: r.summary ?? undefined,
              deepLink: r.deep_link ?? undefined,
              occurredAt: iso(r.occurred_at),
            }),
          ),
          nextCursor: hasMore && last ? encodeCursor(last.occurred_at, last.id) : undefined,
        };
      },
      { as: 'user', userId },
    );
  }
}
