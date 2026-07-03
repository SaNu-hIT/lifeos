// Postgres-backed GroceryListRepositoryPort. Writes/reads run in USER context so
// grocery.list_items' RLS policy (0018_grocery_list.sql) is enforced — a user can
// only ever see their own list, same pattern as ConversationRepository.

import type { DatabasePort } from '@lifeos/api';
import type { GroceryListRepositoryPort, ListItem } from '@lifeos/skill-grocery';

interface ListItemRow {
  id: string;
  user_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  created_at: string;
}

function toListItem(row: ListItemRow): ListItem {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export class PgGroceryListRepository implements GroceryListRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async addItem(
    userId: string,
    item: { name: string; quantity: number; unit?: string },
  ): Promise<ListItem> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<ListItemRow>(
          `insert into grocery.list_items (user_id, name, quantity, unit)
           values ($1, $2, $3, $4) returning id, user_id, name, quantity, unit, created_at`,
          [userId, item.name, item.quantity, item.unit ?? null],
        );
        return toListItem(r.rows[0]!);
      },
      { as: 'user', userId },
    );
  }

  async removeItem(userId: string, itemId: string): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query('delete from grocery.list_items where id = $1 and user_id = $2', [itemId, userId]);
      },
      { as: 'user', userId },
    );
  }

  async listItems(userId: string): Promise<ListItem[]> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<ListItemRow>(
          `select id, user_id, name, quantity, unit, created_at from grocery.list_items
            where user_id = $1
            order by created_at asc`,
          [userId],
        );
        return r.rows.map(toListItem);
      },
      { as: 'user', userId },
    );
  }
}
