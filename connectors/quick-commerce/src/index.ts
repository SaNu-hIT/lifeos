// @lifeos/connector-quick-commerce — grocery connectors for India's quick-commerce platforms,
// all implementing the same GroceryProviderPort so the Skill/Registry/compare tools fan out
// over them without knowing which store is which (ADR-0005).
//
// Read-only price scrapers (no order placement). Blinkit/Zepto scrape live via a real browser;
// Instamart/JioMart use their mobile JSON API (need session params in env, or a browser
// location handshake). A connector with no data reports unhealthy → the comparison falls back
// to cache.

import type { GroceryProviderPort } from '@lifeos/skill-grocery';
import { createBlinkitConnector } from './platforms/blinkit.js';
import { createZeptoConnector } from './platforms/zepto.js';
import { createInstamartConnector } from './platforms/instamart.js';
import { createJioMartConnector } from './platforms/jiomart.js';
import { createAllPlaywrightConnectors, createPlaywrightConnector } from './recipes.js';

export * from './core.js';
export * from './playwright-driver.js';
export { RECIPES, createPlaywrightConnector, createAllPlaywrightConnectors } from './recipes.js';
export { createBlinkitConnector, createZeptoConnector, createInstamartConnector, createJioMartConnector };
export { parseBlinkit } from './platforms/blinkit.js';
export { parseZepto } from './platforms/zepto.js';
export { parseInstamart } from './platforms/instamart.js';
export { parseJioMart } from './platforms/jiomart.js';

/** The JSON-API connector factories (plain fetch), kept for the mobile-API path (Instamart/
 *  JioMart) — they consume captured session params from env. Blinkit/Zepto use Playwright. */
export const jsonConnectorFactories = {
  blinkit: createBlinkitConnector,
  zepto: createZeptoConnector,
  instamart: createInstamartConnector,
  jiomart: createJioMartConnector,
};

/** The quick-commerce connectors registered under the 'grocery' domain.
 *
 *  Transport chosen by what actually works per platform:
 *  - Blinkit, Zepto → Playwright (a real browser passes their web anti-bot edge). Live today.
 *  - Instamart, JioMart → mobile JSON API (web is location-gated). Need session params in env
 *    (see README) or a browser location handshake; without them → unhealthy → cache fallback.
 *
 *  (BigBasket and Flipkart Minutes were removed — hard 403 anti-bot and low-value/brittle
 *  respectively.) */
export function createAllQuickCommerceConnectors(): GroceryProviderPort[] {
  return [
    createPlaywrightConnector('blinkit'),
    createPlaywrightConnector('zepto'),
    createInstamartConnector(),
    createJioMartConnector(),
  ];
}
