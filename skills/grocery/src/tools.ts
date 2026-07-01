// The Grocery tools — the units the Planner can call (ADR-0004: AI holds no logic;
// all rules live here). Handlers close over injected ports, so the Skill is pure and
// testable with fakes. userId + timestamps come from the Unified Context (no hidden
// clocks/globals, docs/02 §8).

import type { DomainEvent, Tool, UnifiedContext } from '@lifeos/contracts';
import type { Product } from './domain/types.js';
import { addLine, cartTotalMinor, isEmpty } from './domain/cart.js';
import type { GroceryProviderPort } from './ports/grocery-provider.port.js';
import type { GroceryRepositoryPort } from './ports/grocery-repository.port.js';
import { GROCERY_ORDER_PLACED, type OrderPlacedPayload } from './surface.js';

export interface GroceryToolDeps {
  repository: GroceryRepositoryPort;
  provider: GroceryProviderPort;
  /** Order-id factory, supplied by the composition root (deterministic in tests).
   *  Injected rather than imported so the Skill stays free of platform/runtime deps. */
  newId: () => string;
  /** Publishes a domain event to the platform outbox (injected; no-op if absent).
   *  Drives the surface contributions (activity/notification) in phase 26. */
  publish?: (event: DomainEvent) => Promise<void>;
}

const PRODUCT_PROPS = {
  id: { type: 'string' },
  name: { type: 'string' },
  priceMinor: { type: 'integer' },
  unit: { type: 'string' },
} as const;

interface SearchArgs {
  query: string;
}
interface BuildCartArgs {
  items: Array<Product & { quantity: number }>;
}

export function createGroceryTools(deps: GroceryToolDeps): Tool[] {
  const { newId } = deps;

  const searchProducts: Tool<SearchArgs, { products: Product[] }> = {
    name: 'grocery.search_products',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      properties: { products: { type: 'array' } },
      required: ['products'],
    },
    requiredCapability: 'grocery.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (_ctx: UnifiedContext, args: SearchArgs) => ({
      products: await deps.provider.searchProducts(args.query),
    }),
  };

  const buildCart: Tool<BuildCartArgs, { lineCount: number; totalMinor: number }> = {
    name: 'grocery.build_cart',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { ...PRODUCT_PROPS, quantity: { type: 'integer' } },
            required: ['id', 'name', 'priceMinor', 'unit', 'quantity'],
          },
        },
      },
      required: ['items'],
    },
    outputSchema: {
      type: 'object',
      properties: { lineCount: { type: 'integer' }, totalMinor: { type: 'integer' } },
      required: ['lineCount', 'totalMinor'],
    },
    requiredCapability: 'grocery.read',
    idempotent: false,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: BuildCartArgs) => {
      let cart = await deps.repository.getCart(ctx.user.id);
      for (const item of args.items) {
        const { quantity, ...product } = item;
        cart = addLine(cart, product, quantity);
      }
      await deps.repository.saveCart(cart);
      return { lineCount: cart.lines.length, totalMinor: cartTotalMinor(cart) };
    },
  };

  const requestConfirmation: Tool<Record<string, never>, { summary: string; totalMinor: number }> = {
    name: 'grocery.request_confirmation',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: {
      type: 'object',
      properties: { summary: { type: 'string' }, totalMinor: { type: 'integer' } },
      required: ['summary', 'totalMinor'],
    },
    requiredCapability: 'grocery.order',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext) => {
      const cart = await deps.repository.getCart(ctx.user.id);
      const total = cartTotalMinor(cart);
      const summary = cart.lines
        .map((l) => `${l.quantity}× ${l.product.name}`)
        .join(', ');
      return { summary: summary || '(empty cart)', totalMinor: total };
    },
  };

  const placeOrder: Tool<Record<string, never>, { orderId: string; status: string; etaMinutes?: number }> = {
    name: 'grocery.place_order',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        status: { type: 'string' },
        etaMinutes: { type: 'integer' },
      },
      required: ['orderId', 'status'],
    },
    requiredCapability: 'grocery.order',
    idempotent: false,
    requiresConfirmation: true, // irreversible: the platform gates on user confirmation
    handler: async (ctx: UnifiedContext) => {
      const cart = await deps.repository.getCart(ctx.user.id);
      if (isEmpty(cart)) throw new Error('cannot place an order with an empty cart');

      const submitted = await deps.provider.submitOrder(ctx.user.id, cart.lines);
      const order = {
        id: newId(),
        userId: ctx.user.id,
        lines: cart.lines,
        totalMinor: cartTotalMinor(cart),
        status: 'placed' as const,
        providerOrderId: submitted.providerOrderId,
        etaMinutes: submitted.etaMinutes,
        placedAt: ctx.now,
      };
      await deps.repository.saveOrder(order);
      await deps.repository.clearCart(ctx.user.id);

      // Announce the order so the surface engines react (activity/notification).
      if (deps.publish) {
        const payload: OrderPlacedPayload = {
          orderId: order.id,
          providerOrderId: order.providerOrderId,
          itemCount: order.lines.length,
          totalMinor: order.totalMinor,
          etaMinutes: order.etaMinutes,
        };
        await deps.publish({
          eventId: newId(),
          type: GROCERY_ORDER_PLACED,
          userId: ctx.user.id,
          occurredAt: ctx.now,
          payload,
        });
      }
      return { orderId: order.id, status: order.status, etaMinutes: order.etaMinutes };
    },
  };

  return [searchProducts, buildCart, requestConfirmation, placeOrder];
}
