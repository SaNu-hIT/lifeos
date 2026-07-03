// Postgres-backed GroceryPreferencePort — user-scoped like pg-grocery-list.repository,
// runs under the user's RLS context (0019_grocery_preferences.sql).

import type { DatabasePort } from '@lifeos/api';
import type { GroceryPreference, GroceryPreferencePort } from '@lifeos/skill-grocery';

interface PreferenceRow {
  user_id: string;
  product_name: string;
  preferred_brand: string;
  preferred_quantity: number | null;
  preferred_unit: string | null;
}

function toPreference(row: PreferenceRow): GroceryPreference {
  return {
    userId: row.user_id,
    productName: row.product_name,
    preferredBrand: row.preferred_brand,
    preferredQuantity: row.preferred_quantity ?? undefined,
    preferredUnit: row.preferred_unit ?? undefined,
  };
}

export class PgGroceryPreferenceAdapter implements GroceryPreferencePort {
  constructor(private readonly db: DatabasePort) {}

  async get(userId: string, productName: string): Promise<GroceryPreference | undefined> {
    const r = await this.db.query<PreferenceRow>(
      `select user_id, product_name, preferred_brand, preferred_quantity, preferred_unit
         from grocery.user_preferences
        where user_id = $1 and product_name = $2`,
      [userId, productName],
    );
    return r.rows[0] ? toPreference(r.rows[0]) : undefined;
  }

  async set(pref: GroceryPreference): Promise<void> {
    await this.db.query(
      `insert into grocery.user_preferences (user_id, product_name, preferred_brand, preferred_quantity, preferred_unit, updated_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (user_id, product_name)
       do update set preferred_brand = excluded.preferred_brand,
                      preferred_quantity = excluded.preferred_quantity,
                      preferred_unit = excluded.preferred_unit,
                      updated_at = now()`,
      [pref.userId, pref.productName, pref.preferredBrand, pref.preferredQuantity ?? null, pref.preferredUnit ?? null],
    );
  }
}
