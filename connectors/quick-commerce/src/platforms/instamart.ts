// Swiggy Instamart MOBILE-API connector.
//
// The web search page is location-gated (no products without an address flow), but the
// mobile/dapi endpoint `/api/instamart/search/v2` is REAL and reachable (probed: HTTP 200).
// It returns data only with a captured session: a valid cookie, the resolved storeId for the
// delivery location, and the device/lat-lng headers the app sends. Capture those from the app
// (see README "Mobile-API capture runbook") into env — without them the connector is
// unhealthy and the comparison falls back to cache.

import type { GroceryProviderPort, Product } from '@lifeos/skill-grocery';
import {
  compact, defineJsonGroceryConnector, num, obj, pickArray, rupeesToMinor, stockStatusOf, str,
  type HttpRequest, type JsonConnectorSpec, type SearchContext,
} from '../core.js';

export function parseInstamart(raw: unknown): Product[] {
  // TODO(verify-capture): confirm the array path + field keys from a real captured response.
  const items = pickArray(raw, [
    'data.products', 'data.widgets', 'data.items', 'products', 'data.searchResults',
  ]);
  const out: Product[] = [];
  for (const it of items) {
    const item = obj(it);
    const variations = pickArray(item, ['variations']);
    const v = variations.length ? obj(variations[0]) : item;
    const name = str(item.display_name) ?? str(item.name) ?? str(item.itemName);
    const price = obj(v.price);
    // Swiggy commonly exposes prices in paise already; fall back to rupees→paise.
    const offerPaise = num(price.offer_price) ?? num(v.offer_price);
    const priceMinor = offerPaise ?? (num(item.price) !== undefined ? rupeesToMinor(num(item.price)!) : undefined);
    if (!name || priceMinor === undefined) continue;
    const mrpPaise = num(price.mrp) ?? num(v.mrp);
    out.push(
      compact({
        id: `instamart-${str(item.product_id) ?? str(item.itemId) ?? name}`,
        name,
        priceMinor,
        unit: str(v.quantity) ?? str(item.unit) ?? 'unit',
        brand: str(item.brand) ?? str(item.brandName),
        size: str(v.quantity) ?? str(item.unit),
        mrpMinor: mrpPaise,
        discountMinor: mrpPaise !== undefined && mrpPaise > priceMinor ? mrpPaise - priceMinor : undefined,
        imageUrl: str(item.images) ?? str(item.imageUrl),
        stockStatus: stockStatusOf(v.inventory !== undefined ? num(obj(v.inventory).quantity)! > 0 : item.inStock === true ? true : item.inStock === false ? false : undefined),
      }) as Product,
    );
  }
  return out;
}

export function createInstamartConnector(): GroceryProviderPort {
  const spec: JsonConnectorSpec = {
    config: {
      key: 'instamart',
      baseUrl: process.env.SWIGGY_INSTAMART_BASE ?? 'https://www.swiggy.com/api/instamart',
      // Captured from the app session (see runbook). Without it → unhealthy → cache fallback.
      cookie: process.env.SWIGGY_INSTAMART_COOKIE,
      headers: compact({
        'user-agent': process.env.SWIGGY_UA ?? 'Swiggy-Android/6.22.0',
        // The app sends the delivery location as a `matcher: lat,lng` header.
        matcher: process.env.SWIGGY_LATLNG, // e.g. "9.9312,76.2673" for Kochi
        'content-type': 'application/json',
      }) as Record<string, string>,
      rateLimitPerMin: 50,
      proxyUrl: process.env.QC_PROXY_URL,
      defaultPincode: process.env.QC_DEFAULT_PINCODE ?? '400001',
    },
    buildSearch(query: string, ctx: SearchContext): HttpRequest {
      const u = new URL(`${ctx.config.baseUrl}/search/v2`);
      u.searchParams.set('query', query);
      u.searchParams.set('limit', '20');
      u.searchParams.set('pageNumber', '0');
      // storeId is resolved from the delivery location — capture it from the app (runbook).
      if (process.env.SWIGGY_STORE_ID) u.searchParams.set('storeId', process.env.SWIGGY_STORE_ID);
      return { url: u.toString() };
    },
    parse: parseInstamart,
  };
  return defineJsonGroceryConnector(spec);
}
