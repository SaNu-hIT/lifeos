import type { DatabasePort } from '../../../../shared/database/database.port.js';
import type {
  NotificationChannelName,
  NotificationImportance,
  NotificationIntent,
  NotificationPage,
  NotificationView,
} from '../../domain/ports/notification.port.js';

interface NotificationRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  importance: string;
  deep_link: string | null;
  read_at: string | null;
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
function toView(r: NotificationRow): NotificationView {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    title: r.title,
    body: r.body ?? undefined,
    importance: r.importance as NotificationImportance,
    deepLink: r.deep_link ?? undefined,
    readAt: r.read_at ? iso(r.read_at) : undefined,
    occurredAt: iso(r.occurred_at),
  };
}

export class NotificationRepository {
  constructor(private readonly db: DatabasePort) {}

  /** Insert a notification in SERVICE context (the engine is system-level).
   *  Returns the stored view, or null if a duplicate `dedupeKey` was suppressed. */
  async insert(
    intent: NotificationIntent,
    externalChannels: NotificationChannelName[],
  ): Promise<NotificationView | null> {
    const res = await this.db.query<NotificationRow>(
      `insert into surface.notifications
         (user_id, kind, title, body, importance, deep_link, dedupe_key, channels, occurred_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
       returning id, user_id, kind, title, body, importance, deep_link, read_at, occurred_at`,
      [
        intent.userId,
        intent.kind,
        intent.title,
        intent.body ?? null,
        intent.importance ?? 'normal',
        intent.deepLink ?? null,
        intent.dedupeKey ?? null,
        externalChannels,
        intent.occurredAt,
      ],
    );
    return res.rows[0] ? toView(res.rows[0]) : null;
  }

  /** Read the user's inbox in USER context (RLS). */
  async inbox(userId: string, limit: number, cursor?: string): Promise<NotificationPage> {
    const c = cursor ? decodeCursor(cursor) : undefined;
    return this.db.transaction(
      async (tx) => {
        const rows = await tx.query<NotificationRow>(
          `select id, user_id, kind, title, body, importance, deep_link, read_at, occurred_at
             from surface.notifications
            where ($1::timestamptz is null or (occurred_at, id) < ($1::timestamptz, $2::uuid))
            order by occurred_at desc, id desc
            limit $3`,
          [c?.occurredAt ?? null, c?.id ?? null, limit + 1],
        );
        const hasMore = rows.rows.length > limit;
        const slice = rows.rows.slice(0, limit);
        const last = slice[slice.length - 1];
        return {
          data: slice.map(toView),
          nextCursor: hasMore && last ? encodeCursor(last.occurred_at, last.id) : undefined,
        };
      },
      { as: 'user', userId },
    );
  }

  /** Mark one notification read in USER context (RLS enforces ownership). */
  async markRead(userId: string, id: string): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `update surface.notifications set read_at = now()
            where id = $1 and read_at is null`,
          [id],
        );
      },
      { as: 'user', userId },
    );
  }
}
