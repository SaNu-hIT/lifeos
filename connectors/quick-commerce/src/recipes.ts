// Per-platform Playwright DOM recipes. Live-probe status (headless Chromium, no login):
//   blinkit   ✅ 200, 62 product cards — selectors below CONFIRMED live
//   zepto     ✅ 200, products render   — selectors from connector-zepto-live
//   instamart ⚠️ 200 but 0 products     — needs a location/address step (TODO)
//   jiomart   ⚠️ 200 but 0 products     — needs a pincode step (TODO)
// A recipe that returns [] (selector miss / no products) degrades to cache fallback, never crashes.
// (BigBasket and Flipkart Minutes were removed — hard 403 anti-bot / low-value + brittle.)

import type { GroceryProviderPort } from '@lifeos/skill-grocery';
import { definePlaywrightGroceryConnector, type DomRecipe } from './playwright-driver.js';

export const RECIPES: Record<string, DomRecipe> = {
  // CONFIRMED live: blinkit.com/s/?q= renders `div[role=button][data-pf=reset]` cards.
  blinkit: {
    key: 'blinkit',
    url: (q) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}`,
    pincodeStorageKey: 'blinkit_pincode',
    card: 'div[role="button"][data-pf="reset"]',
    settleMs: 3500,
    sel: {
      name: '.tw-text-300.tw-font-semibold.tw-line-clamp-2',
      price: '.tw-text-200.tw-font-semibold',
      unit: '.tw-text-200.tw-font-medium.tw-line-clamp-1',
      mrp: '.tw-line-through', // TODO(verify-live)
      image: 'img',
    },
  },
  // From @lifeos/connector-zepto-live (semantic data-slot-id hooks).
  zepto: {
    key: 'zepto',
    url: (q) => `https://www.zeptonow.com/search?query=${encodeURIComponent(q)}`,
    card: 'a[href^="/pn/"]',
    settleMs: 4000,
    sel: {
      name: '[data-slot-id="ProductName"] span',
      price: '[data-slot-id="EdlpPrice"] span',
      unit: '[data-slot-id="PackSize"] span',
      image: 'img',
    },
  },
  // Best-effort; Flipkart search SSRs product cards.
  // Needs a location/address step before products render — TODO(verify-live).
  instamart: {
    key: 'instamart',
    url: (q) => `https://www.swiggy.com/instamart/search?custom_back=true&query=${encodeURIComponent(q)}`,
    card: '[data-testid="ItemWidgetContainer"] > div', // TODO(verify-live)
    settleMs: 5000,
    sel: { name: '[data-testid="item-name"]', price: '[data-testid="item-offer-price"]', image: 'img' }, // TODO(verify-live)
  },
  // Needs a pincode step before products render — TODO(verify-live).
  jiomart: {
    key: 'jiomart',
    url: (q) => `https://www.jiomart.com/search/${encodeURIComponent(q)}`,
    card: '.ais-InfiniteHits-item', // TODO(verify-live)
    settleMs: 5000,
    sel: { name: '.plp-card-details-name', price: '.jm-heading-xxs', image: 'img' },
  },
};

export function createPlaywrightConnector(key: keyof typeof RECIPES): GroceryProviderPort {
  return definePlaywrightGroceryConnector(RECIPES[key]!);
}

/** All six platforms as Playwright-driven connectors, ready to register under 'grocery'. */
export function createAllPlaywrightConnectors(): GroceryProviderPort[] {
  return Object.keys(RECIPES).map((k) => createPlaywrightConnector(k));
}
