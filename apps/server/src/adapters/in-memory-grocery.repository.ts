// In-memory GroceryRepositoryPort for the composed dev server (data resets on restart).
// Real Postgres adapters are the documented next step; the port keeps that swap local.

import { emptyCart, type Cart, type GroceryRepositoryPort, type Order } from '@lifeos/skill-grocery';

export class InMemoryGroceryRepository implements GroceryRepositoryPort {
  private readonly carts = new Map<string, Cart>();
  private readonly orders: Order[] = [];

  async getCart(userId: string): Promise<Cart> {
    return this.carts.get(userId) ?? emptyCart(userId);
  }
  async saveCart(cart: Cart): Promise<void> {
    this.carts.set(cart.userId, cart);
  }
  async clearCart(userId: string): Promise<void> {
    this.carts.delete(userId);
  }
  async saveOrder(order: Order): Promise<void> {
    this.orders.push(order);
  }
  async getOrder(userId: string, orderId: string): Promise<Order | undefined> {
    return this.orders.find((o) => o.userId === userId && o.id === orderId);
  }
  async recentOrders(userId: string, limit: number): Promise<Order[]> {
    return this.orders
      .filter((o) => o.userId === userId)
      .slice()
      .reverse()
      .slice(0, limit);
  }
}
