// JioMart JSON-API connector. Seeded from shoppingassist/connectors/jiomart.
// UNVERIFIED — TODO(verify-live)/runbook.

import type { GroceryProviderPort, Product } from '@lifeos/skill-grocery';
import {
  compact, defineJsonGroceryConnector, num, obj, pickArray, rupeesToMinor, stockStatusOf, str,
  type HttpRequest, type JsonConnectorSpec, type SearchContext,
} from '../core.js';

export function parseJioMart(raw: unknown): Product[] {
  const items = pickArray(raw, ['results', 'products', 'data.products', 'catalog.products']);
  const out: Product[] = [];
  for (const it of items) {
    const item = obj(it);
    const name = str(item.name);
    const price = num(item.price);
    if (!name || price === undefined) continue;
    const mrp = num(item.mrp);
    out.push(
      compact({
        id: `jiomart-${str(item.sku) ?? name}`,
        name,
        priceMinor: rupeesToMinor(price),
        unit: str(item.size) ?? 'unit',
        brand: str(item.brand),
        size: str(item.size),
        mrpMinor: mrp !== undefined ? rupeesToMinor(mrp) : undefined,
        discountMinor: mrp !== undefined && mrp > price ? rupeesToMinor(mrp - price) : undefined,
        deliveryEtaMinutes: num(item.etaText),
        imageUrl: str(item.imageUrl),
        stockStatus: stockStatusOf(item.inStock === true ? true : item.inStock === false ? false : undefined),
      }) as Product,
    );
  }
  return out;
}

export function createJioMartConnector(): GroceryProviderPort {
  const spec: JsonConnectorSpec = {
    config: {
      // Web search is location-gated + WAF-blocked; use the mobile app API (Algolia-backed).
      // Endpoint + auth are TODO(verify-capture) — set JIOMART_MOBILE_BASE + JIOMART_COOKIE.
      key: 'jiomart',
      baseUrl: process.env.JIOMART_MOBILE_BASE ?? process.env.JIOMART_BASE_URL ?? 'https://www.jiomart.com/mst/rest/v1/5',
      cookie: process.env.JIOMART_COOKIE,
      headers: { 'user-agent': process.env.JIOMART_UA ?? 'JioMart-Android/1.0' },
      rateLimitPerMin: 80,
      proxyUrl: process.env.QC_PROXY_URL,
      defaultPincode: process.env.QC_DEFAULT_PINCODE ?? '400001',
    },
    buildSearch(query: string, ctx: SearchContext): HttpRequest {
      const u = new URL(`${ctx.config.baseUrl}/search`);
      u.searchParams.set('q', query);
      u.searchParams.set('pin', ctx.pincode); // TODO(verify-live)
      return { url: u.toString() };
    },
    parse: parseJioMart,
  };
  return defineJsonGroceryConnector(spec);
}
