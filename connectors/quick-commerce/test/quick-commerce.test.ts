import { describe, expect, it } from 'vitest';
import { runReadOnlyGroceryProviderContractTests } from '@lifeos/skill-grocery';
import {
  createAllQuickCommerceConnectors,
  createBlinkitConnector,
  jsonConnectorFactories,
  parseBlinkit,
  parseInstamart,
  parseJioMart,
  parseZepto,
} from '../src/index.js';

describe('quick-commerce parsers map raw JSON → rich Product', () => {
  it('blinkit: nested pricing/inventory/delivery/media', () => {
    const raw = {
      products: [
        {
          skuId: '1001',
          title: 'Amul Taaza Fresh Toned Milk',
          brandName: 'Amul',
          sizeInfo: '1 L',
          pricing: { sellingPrice: 56, mrp: 60, discountAmt: 4 },
          inventory: { status: 'AVAILABLE', stockQty: 42 },
          delivery: { etaMinutes: 12 },
          media: { primaryImage: 'https://img/milk.jpg' },
          ratingVal: 4.3,
        },
      ],
    };
    expect(parseBlinkit(raw)[0]).toMatchObject({
      id: 'blinkit-1001',
      name: 'Amul Taaza Fresh Toned Milk',
      priceMinor: 5600,
      mrpMinor: 6000,
      discountMinor: 400,
      unit: '1 L',
      brand: 'Amul',
      size: '1 L',
      deliveryEtaMinutes: 12,
      imageUrl: 'https://img/milk.jpg',
      rating: 4.3,
      stockStatus: 'in_stock',
    });
  });

  it('zepto: priceDetails + outOfStock + string eta', () => {
    const raw = {
      products: [
        {
          id: 'z1',
          name: 'Mother Dairy Milk',
          brand: 'Mother Dairy',
          formattedSize: '500 ml',
          priceDetails: { discountedPrice: 27, mrp: 30, discountPercent: 10 },
          outOfStock: true,
          eta: '10 mins',
          imageDetails: { url: 'https://img/z.jpg' },
        },
      ],
    };
    expect(parseZepto(raw)[0]).toMatchObject({
      id: 'zepto-z1',
      priceMinor: 2700,
      mrpMinor: 3000,
      discountMinor: 300,
      deliveryEtaMinutes: 10,
      stockStatus: 'out_of_stock',
      imageUrl: 'https://img/z.jpg',
    });
  });

  it('instamart / jiomart: mobile + flat schemas', () => {
    // Swiggy Instamart mobile shape: variations[].price.{offer_price,mrp} in paise.
    expect(parseInstamart({ data: { products: [{ product_id: 'i1', display_name: 'Curd', brand: 'Amul', images: 'u', variations: [{ quantity: '400 g', price: { offer_price: 3500, mrp: 4000 }, inventory: { quantity: 10 } }] }] } })[0]).toMatchObject({
      id: 'instamart-i1', priceMinor: 3500, mrpMinor: 4000, discountMinor: 500, stockStatus: 'in_stock', size: '400 g',
    });
    expect(parseJioMart({ results: [{ sku: 'j1', name: 'Sugar', brand: 'Madhur', size: '1 kg', price: 45, mrp: 50, inStock: false, etaText: '45 mins', imageUrl: 'u' }] })[0]).toMatchObject({
      id: 'jiomart-j1', priceMinor: 4500, stockStatus: 'out_of_stock',
    });
  });

  it('drops items missing a name or price (defensive)', () => {
    expect(parseBlinkit({ products: [{ skuId: 'x' }, { title: 'No price' }] })).toEqual([]);
    expect(parseZepto('garbage')).toEqual([]);
  });
});

describe('quick-commerce connectors', () => {
  it('report unhealthy without credentials (→ registry failover / cache fallback)', async () => {
    const blinkit = createBlinkitConnector(); // no BLINKIT_COOKIE in test env
    const health = await blinkit.health();
    expect(health.healthy).toBe(false);
    // searchProducts must throw (not return []) so the comparison falls back to cache.
    await expect(blinkit.searchProducts('milk')).rejects.toThrow(/credentials/i);
  });

  it('all json connectors satisfy the read-only grocery contract (offline)', async () => {
    // Use the JSON factories here — the Playwright connectors' health() launches a real
    // browser, which belongs in the live test, not the unit suite.
    for (const make of Object.values(jsonConnectorFactories)) {
      const connector = make();
      await expect(runReadOnlyGroceryProviderContractTests(connector)).resolves.toBeUndefined();
      expect(connector.domain).toBe('grocery');
    }
  });

  it('exposes the four active platform keys', () => {
    // Construction is cheap — no browser launches until health()/searchProducts() is called.
    expect(createAllQuickCommerceConnectors().map((c) => c.key).sort()).toEqual(
      ['blinkit', 'instamart', 'jiomart', 'zepto'],
    );
  });
});
