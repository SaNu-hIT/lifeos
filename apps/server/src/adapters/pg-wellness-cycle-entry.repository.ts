// Postgres-backed CycleEntryRepositoryPort. User-owned data — runs in USER context
// so wellness.cycle_entries' RLS policy (0027_wellness_cycle_entries.sql) is enforced.

import type { DatabasePort } from '@lifeos/api';
import type { CycleDayEntry, CycleEntryRepositoryPort, FlowIntensity } from '@lifeos/skill-wellness';

interface EntryRow {
  id: string;
  user_id: string;
  entry_date: string;
  flow: FlowIntensity | null;
  symptoms: string[];
  basal_body_temp_c: string | number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function toEntry(row: EntryRow): CycleDayEntry {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.entry_date,
    flow: row.flow ?? undefined,
    symptoms: row.symptoms.length > 0 ? row.symptoms : undefined,
    basalBodyTempC: row.basal_body_temp_c != null ? Number(row.basal_body_temp_c) : undefined,
    notes: row.notes ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const ENTRY_COLUMNS = `id, user_id, entry_date, flow, symptoms, basal_body_temp_c, notes, created_at, updated_at`;

export class PgWellnessCycleEntryRepository implements CycleEntryRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async upsertEntry(entry: CycleDayEntry): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `insert into wellness.cycle_entries
             (id, user_id, entry_date, flow, symptoms, basal_body_temp_c, notes, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           on conflict (user_id, entry_date)
           do update set flow = excluded.flow,
                          symptoms = excluded.symptoms,
                          basal_body_temp_c = excluded.basal_body_temp_c,
                          notes = excluded.notes,
                          updated_at = excluded.updated_at`,
          [
            entry.id,
            entry.userId,
            entry.date,
            entry.flow ?? null,
            entry.symptoms ?? [],
            entry.basalBodyTempC ?? null,
            entry.notes ?? null,
            entry.createdAt,
            entry.updatedAt,
          ],
        );
      },
      { as: 'user', userId: entry.userId },
    );
  }

  async deleteEntry(userId: string, date: string): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query('delete from wellness.cycle_entries where user_id = $1 and entry_date = $2', [userId, date]);
      },
      { as: 'user', userId },
    );
  }

  async entriesInRange(userId: string, fromDate: string, toDate: string): Promise<CycleDayEntry[]> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<EntryRow>(
          `select ${ENTRY_COLUMNS} from wellness.cycle_entries
            where user_id = $1 and entry_date between $2 and $3
            order by entry_date asc`,
          [userId, fromDate, toDate],
        );
        return r.rows.map(toEntry);
      },
      { as: 'user', userId },
    );
  }

  async recentEntries(userId: string, limit: number): Promise<CycleDayEntry[]> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<EntryRow>(
          `select ${ENTRY_COLUMNS} from wellness.cycle_entries
            where user_id = $1
            order by entry_date desc
            limit $2`,
          [userId, limit],
        );
        return r.rows.map(toEntry);
      },
      { as: 'user', userId },
    );
  }
}
