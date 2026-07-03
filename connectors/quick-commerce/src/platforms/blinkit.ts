// Blinkit JSON-API connector. Seeded from shoppingassist/connectors/blinkit (endpoint,
// headers) and its RawBlinkitItem schema. Endpoint path/params and JSON field paths are
// UNVERIFIED against the live API — see TODO(verify-live) and the package runbook.

import type { GroceryProviderPort, Product } from '@lifeos/skill-grocery';
import {
  compact, defineJsonGroceryConnector, num, obj, pickArray, rupeesToMinor, stockStatusOf, str,
  type HttpRequest, type JsonConnectorSpec, type SearchContext,
} from '../core.js';

export function parseBlinkit(raw: unknown): Product[] {
  // TODO(verify-live): confirm the array path in the real response envelope.
  const items = pickArray(raw, ['products', 'data.products', 'response.products', 'objects']);
  const out: Product[] = [];
  for (const it of items) {
    const item = obj(it);
    const name = str(item.title) ?? str(item.name);
    const pricing = obj(item.pricing);
    const price = num(pricing.sellingPrice) ?? num(item.price);
    if (!name || price === undefined) continue;
    const inventory = obj(item.inventory);
    const status = str(inventory.status);
    const qty = num(inventory.stockQty);
    const mrp = num(pricing.mrp);
    out.push(
      compact({
        id: `blinkit-${str(item.skuId) ?? str(item.id) ?? name}`,
        name,
        priceMinor: rupeesToMinor(price),
        unit: str(item.sizeInfo) ?? str(item.unit) ?? 'unit',
        brand: str(item.brandName) ?? str(item.brand),
        size: str(item.sizeInfo),
        mrpMinor: mrp !== undefined ? rupeesToMinor(mrp) : undefined,
        discountMinor: num(pricing.discountAmt) !== undefined ? rupeesToMinor(num(pricing.discountAmt)!) : undefined,
        deliveryEtaMinutes: num(obj(item.delivery).etaMinutes),
        imageUrl: str(obj(item.media).primaryImage),
        rating: num(item.ratingVal),
        stockStatus: stockStatusOf(status ? status === 'AVAILABLE' : undefined, qty),
      }) as Product,
    );
  }
  return out;
}

export function createBlinkitConnector(): GroceryProviderPort {
  const spec: JsonConnectorSpec = {
    config: {
      key: 'blinkit',
      baseUrl: process.env.BLINKIT_BASE_URL ?? 'https://api.blinkit.com/v2',
      cookie: process.env.BLINKIT_COOKIE,
      headers: {
        'user-agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Blinkit/Android/3.14.0',
        'x-app-version': '3.14.0',
      },
      rateLimitPerMin: 60,
      proxyUrl: process.env.QC_PROXY_URL,
      defaultPincode: process.env.QC_DEFAULT_PINCODE ?? '400001',
    },
    buildSearch(query: string, ctx: SearchContext): HttpRequest {
      // TODO(verify-live): real Blinkit search likely needs lat/lng, not pincode.
      const u = new URL(`${ctx.config.baseUrl}/search`);
      u.searchParams.set('q', query);
      u.searchParams.set('pincode', ctx.pincode);
      return { url: u.toString() };
    },
    parse: parseBlinkit,
  };
  return defineJsonGroceryConnector(spec);
}
