// Grocery's surface contributions — how the Skill shows up across the user's LifeOS
// surfaces (docs/02 §15) once an order is placed. All declarative: the SkillHost
// (phase 22) installs these into the Activity (19), Notification (20) and Home (21)
// engines. Reacts to the Skill's own `grocery.order_placed` domain event; widgets pull
// from the repository read model. No platform imports (ADR-0001).

import type {
  ActivityProjection,
  DomainEvent,
  NotificationDeclaration,
  WidgetContribution,
} from '@lifeos/contracts';
import { deriveStaples } from './personalization.js';
import type { GroceryRepositoryPort } from './ports/grocery-repository.port.js';

/** The domain event `grocery.place_order` publishes. */
export const GROCERY_ORDER_PLACED = 'grocery.order_placed';

export interface OrderPlacedPayload {
  orderId: string;
  providerOrderId?: string;
  itemCount: number;
  totalMinor: number;
  etaMinutes?: number;
}

function rupees(minor: number): string {
  return `₹${(minor / 100).toFixed(2)}`;
}

/** Feed entry: "Placed a grocery order". */
export function createGroceryActivityProjection(): ActivityProjection {
  return {
    key: 'grocery.order_placed',
    on: GROCERY_ORDER_PLACED,
    build: (event: DomainEvent) => {
      const p = event.payload as OrderPlacedPayload;
      return {
        userId: event.userId!,
        kind: GROCERY_ORDER_PLACED,
        title: 'Placed a grocery order',
        summary: `${p.itemCount} item(s), ${rupees(p.totalMinor)}`,
        deepLink: `/grocery/orders/${p.orderId}`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

/** Notification: "Your groceries are on the way". */
export function createGroceryNotification(): NotificationDeclaration {
  return {
    key: 'grocery.order_placed',
    on: GROCERY_ORDER_PLACED,
    build: (event: DomainEvent) => {
      const p = event.payload as OrderPlacedPayload;
      const eta = p.etaMinutes != null ? ` — arriving in ~${p.etaMinutes} min` : '';
      return {
        userId: event.userId!,
        kind: GROCERY_ORDER_PLACED,
        title: 'Your groceries are on the way',
        body: `${p.itemCount} item(s), ${rupees(p.totalMinor)}${eta}`,
        importance: 'normal',
        channels: ['in_app', 'push'],
        deepLink: `/grocery/orders/${p.orderId}`,
        dedupeKey: `grocery.order.${p.orderId}`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export interface GroceryWidgetDeps {
  repository: GroceryRepositoryPort;
  historyWindow?: number;
}

/** Home widgets: a "reorder your usual" card and a "last order" card, both built from
 *  the read model. Capability-gated on `grocery.read`; return null to render nothing. */
export function createGroceryWidgets(deps: GroceryWidgetDeps): WidgetContribution[] {
  const window = deps.historyWindow ?? 10;

  const reorder: WidgetContribution = {
    key: 'grocery.reorder',
    title: 'Reorder your usual',
    requiredCapability: 'grocery.read',
    priority: 20,
    build: async (ctx) => {
      const orders = await deps.repository.recentOrders(ctx.userId, window);
      const staples = deriveStaples(orders);
      if (staples.length === 0) return null; // nothing habitual yet
      return {
        urgency: 0.3,
        props: { staples: staples.map((s) => ({ name: s.product.name, id: s.product.id })) },
      };
    },
  };

  const lastOrder: WidgetContribution = {
    key: 'grocery.last_order',
    title: 'Last order',
    requiredCapability: 'grocery.read',
    priority: 10,
    build: async (ctx) => {
      const [latest] = await deps.repository.recentOrders(ctx.userId, 1);
      if (!latest) return null;
      return {
        asOf: latest.placedAt,
        props: {
          orderId: latest.id,
          itemCount: latest.lines.length,
          totalMinor: latest.totalMinor,
          etaMinutes: latest.etaMinutes ?? null,
        },
      };
    },
  };

  return [reorder, lastOrder];
}
