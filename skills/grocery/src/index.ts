// @lifeos/skill-grocery — Skill #1, the platform's first proof (docs/04 §3).
// Grocery is JUST a Skill: it depends only on the SDK + contracts, owns its domain,
// and plugs in through the standard manifest. The platform has no grocery knowledge.
//
// The Skill is a FACTORY over its ports: a composition root supplies a DB-backed
// repository (deferred) and a real connector (phase-25); tests supply fakes. This
// keeps the package pure and provider-agnostic (ADR-0001, ADR-0005).

import { type SkillManifest } from '@lifeos/contracts';
import { defineSkill } from '@lifeos/skill-sdk';
import { createGroceryTools, type GroceryToolDeps } from './tools.js';
import { createGroceryContextProvider } from './context.js';
import {
  createGroceryActivityProjection,
  createGroceryNotification,
  createGroceryWidgets,
} from './surface.js';

export function createGrocerySkill(deps: GroceryToolDeps): SkillManifest {
  return defineSkill({
    key: 'grocery',
    version: '1.3.0',
    title: 'Grocery',
    description:
      'Manage a shopping list, search products, and compare prices across stores like ' +
      'Blinkit and Zepto to find the cheapest option.',
    contractVersion: '^0.9.0',
    capabilities: [
      { key: 'grocery.read', description: 'Search products, manage the shopping list, build a cart' },
      { key: 'grocery.order', description: 'Place grocery orders' },
    ],
    tools: createGroceryTools(deps),
    // Personalizes the Unified Context with cart, order history, and staples so the
    // Planner can act on habits ("reorder my usual") — phase 24.
    contextProviders: [createGroceryContextProvider({ repository: deps.repository })],
    // Surfaces: feed entry, notification, and home widgets on order placement — phase 26.
    activityProjections: [createGroceryActivityProjection()],
    notifications: [createGroceryNotification()],
    widgets: createGroceryWidgets({ repository: deps.repository }),
  });
}

export * from './domain/types.js';
export * from './domain/cart.js';
export * from './personalization.js';
export type { GroceryProviderPort, SubmittedOrder } from './ports/grocery-provider.port.js';
export type { GroceryRepositoryPort } from './ports/grocery-repository.port.js';
export type { GroceryListRepositoryPort, ListItem } from './ports/grocery-list.port.js';
export type { GroceryPriceCachePort, CachedPrice } from './ports/grocery-price-cache.port.js';
export type { GroceryPreferencePort, GroceryPreference } from './ports/grocery-preference.port.js';
export {
  createGroceryTools,
  type GroceryToolDeps,
  type StorePrice,
  type CompareItemResult,
  type StoreTotal,
  type ClarificationChoice,
  type ClarificationOption,
  type PriceMatrix,
  type PriceCell,
} from './tools.js';
export { createGroceryContextProvider, type GroceryContextDeps } from './context.js';
export { runGroceryProviderContractTests, runReadOnlyGroceryProviderContractTests } from './provider-contract.js';
export {
  GROCERY_ORDER_PLACED,
  createGroceryActivityProjection,
  createGroceryNotification,
  createGroceryWidgets,
  type OrderPlacedPayload,
  type GroceryWidgetDeps,
} from './surface.js';
