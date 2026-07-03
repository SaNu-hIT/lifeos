// Zepto JSON-API connector. Seeded from shoppingassist/connectors/zepto. Endpoint/params
// and JSON field paths are UNVERIFIED — see TODO(verify-live) and the runbook.

import type { GroceryProviderPort, Product } from '@lifeos/skill-grocery';
import {
  compact, defineJsonGroceryConnector, num, obj, pickArray, rupeesToMinor, stockStatusOf, str,
  type HttpRequest, type JsonConnectorSpec, type SearchContext,
} from '../core.js';

export function parseZepto(raw: unknown): Product[] {
  const items = pickArray(raw, ['products', 'items', 'data.products', 'storeProducts']);
  const out: Product[] = [];
  for (const it of items) {
    const item = obj(it);
    const name = str(item.name);
    const pd = obj(item.priceDetails);
    const price = num(pd.discountedPrice) ?? num(item.price);
    if (!name || price === undefined) continue;
    const mrp = num(pd.mrp);
    const outOfStock = item.outOfStock === true;
    out.push(
      compact({
        id: `zepto-${str(item.id) ?? name}`,
        name,
        priceMinor: rupeesToMinor(price),
        unit: str(item.formattedSize) ?? 'unit',
        brand: str(item.brand),
        size: str(item.formattedSize),
        mrpMinor: mrp !== undefined ? rupeesToMinor(mrp) : undefined,
        discountMinor: mrp !== undefined && mrp > price ? rupeesToMinor(mrp - price) : undefined,
        deliveryEtaMinutes: num(item.eta),
        imageUrl: str(obj(item.imageDetails).url),
        stockStatus: stockStatusOf(!outOfStock),
      }) as Product,
    );
  }
  return out;
}

export function createZeptoConnector(): GroceryProviderPort {
  const spec: JsonConnectorSpec = {
    config: {
      key: 'zepto',
      baseUrl: process.env.ZEPTO_BASE_URL ?? 'https://api.zeptonow.com/api/v1',
      cookie: process.env.ZEPTO_COOKIE,
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      rateLimitPerMin: 100,
      proxyUrl: process.env.QC_PROXY_URL,
      defaultPincode: process.env.QC_DEFAULT_PINCODE ?? '400001',
    },
    buildSearch(query: string, ctx: SearchContext): HttpRequest {
      const u = new URL(`${ctx.config.baseUrl}/search`);
      u.searchParams.set('query', query);
      u.searchParams.set('pincode', ctx.pincode); // TODO(verify-live): may need lat/lng + store_id
      return { url: u.toString() };
    },
    parse: parseZepto,
  };
  return defineJsonGroceryConnector(spec);
}
