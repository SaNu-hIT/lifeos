// Grocery's own persistence port. The Skill defines the shape; a concrete adapter
// (DB-backed) is injected at composition time — the Skill package stays pure and is
// tested against an in-memory fake. Grocery data is NOT cross-cutting platform data.

import type { Cart, Order } from '../domain/types.js';

export interface GroceryRepositoryPort {
  getCart(userId: string): Promise<Cart>;
  saveCart(cart: Cart): Promise<void>;
  clearCart(userId: string): Promise<void>;
  saveOrder(order: Order): Promise<void>;
  getOrder(userId: string, orderId: string): Promise<Order | undefined>;
}
