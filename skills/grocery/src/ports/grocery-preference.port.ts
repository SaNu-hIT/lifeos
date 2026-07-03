// Remembers a user's brand/pack-size choice per product, so grocery.compare_prices
// only asks a clarifying question the first time — subsequent runs reuse the saved
// choice instead of re-asking (docs: shopping-list price comparison plan).

export interface GroceryPreference {
  userId: string;
  /** The shopping-list item name this preference applies to, e.g. "milk". */
  productName: string;
  /** The exact scraped product name the user picked, e.g. "Amul Taaza Milk". */
  preferredBrand: string;
  preferredQuantity?: number;
  preferredUnit?: string;
}

export interface GroceryPreferencePort {
  get(userId: string, productName: string): Promise<GroceryPreference | undefined>;
  set(pref: GroceryPreference): Promise<void>;
}
