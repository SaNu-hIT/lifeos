// Grocery's persistent shopping-list port. Unlike a cart (order-in-progress), the
// list is the user's ground-truth "things I want to buy" — structured state, not
// something the Planner has to reconstruct from chat history every turn.

export interface ListItem {
  id: string;
  userId: string;
  name: string;
  quantity: number;
  unit?: string;
  createdAt: string;
}

export interface GroceryListRepositoryPort {
  addItem(userId: string, item: { name: string; quantity: number; unit?: string }): Promise<ListItem>;
  removeItem(userId: string, itemId: string): Promise<void>;
  listItems(userId: string): Promise<ListItem[]>;
}
