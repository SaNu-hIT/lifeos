// The Grocery Context Provider — surfaces the user's grocery state (cart + order
// history + derived staples) into the Unified Context, so the Planner can act on it
// ("reorder my usual"). It reads only through the repository port and contributes to
// the OPEN parts of the context (`settings` namespaced + `memory.preferences`); it
// never invents core fields (ADR-0007, docs/02 §8).

import type { ContextProvider, ContextRequest, Preference, UnifiedContext } from '@lifeos/contracts';
import { cartTotalMinor } from './domain/cart.js';
import { deriveStaples } from './personalization.js';
import type { GroceryRepositoryPort } from './ports/grocery-repository.port.js';

export interface GroceryContextDeps {
  repository: GroceryRepositoryPort;
  /** How many recent orders to consider for staples. */
  historyWindow?: number;
}

export function createGroceryContextProvider(deps: GroceryContextDeps): ContextProvider {
  const window = deps.historyWindow ?? 10;
  return {
    scope: 'grocery',
    async contribute(request: ContextRequest): Promise<Partial<UnifiedContext>> {
      const [cart, orders] = await Promise.all([
        deps.repository.getCart(request.userId),
        deps.repository.recentOrders(request.userId, window),
      ]);

      const staples = deriveStaples(orders);
      const preferences: Preference[] = staples.map((s) => ({
        key: `grocery.staple.${s.product.id}`,
        value: { name: s.product.name, orderCount: s.orderCount },
        scope: 'grocery',
      }));

      return {
        settings: {
          grocery: {
            cart: { lineCount: cart.lines.length, totalMinor: cartTotalMinor(cart) },
            recentOrderCount: orders.length,
            lastOrderAt: orders[0]?.placedAt ?? null,
            staples: staples.map((s) => s.product.name),
          },
        },
        memory: { facts: [], preferences, summaries: [] },
      };
    },
  };
}
