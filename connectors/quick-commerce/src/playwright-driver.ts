// Playwright transport: a real headless browser loads the store's search page (which passes
// the anti-bot edge that plain fetch cannot — verified: fetch gets 403/Access-Denied, the
// browser gets 200 with products), then we extract product cards from the DOM into the rich
// Product model. One shared browser is reused across connectors and queries.
//
// Per-platform selectors live in each platform's DomRecipe. They ARE brittle (stores change
// markup); a selector miss yields [] → the comparison falls back to the price cache, never a
// crash. See each recipe's TODO(verify-live) notes and the README runbook.

import { defineConnector, type ProviderHealth } from '@lifeos/provider-sdk';
import type { GroceryProviderPort, Product, SubmittedOrder } from '@lifeos/skill-grocery';
import { compact, rupeesToMinor, stockStatusOf } from './core.js';

/** A raw product card scraped from the DOM (all strings, as read from the page). */
export interface DomCard {
  name?: string;
  priceText?: string;
  mrpText?: string;
  unit?: string;
  brand?: string;
  ratingText?: string;
  image?: string;
  href?: string;
  soldOut?: boolean;
}

export interface DomRecipe {
  key: string;
  /** Search page URL for a query. */
  url(query: string, pincode: string): string;
  /** Delivery pincode seeded into localStorage before navigation (stores that need it). */
  pincodeStorageKey?: string;
  /** CSS selector for a product card container. */
  card: string;
  /** Field selectors, resolved relative to each card. */
  sel: {
    name: string;
    price: string;
    mrp?: string;
    unit?: string;
    brand?: string;
    rating?: string;
    image?: string;
    soldOut?: string;
  };
  /** ms to wait for cards to render after navigation. */
  settleMs?: number;
}

// ── Shared browser (lazy, reused) ────────────────────────────────────────────
type Browser = import('playwright').Browser;
let browserPromise: Promise<Browser> | undefined;
async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = import('playwright').then(({ chromium }) => chromium.launch({ headless: true }));
  }
  return browserPromise;
}

/** Closes the shared browser (for graceful shutdown / tests). */
export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const b = await browserPromise;
  browserPromise = undefined;
  await b.close();
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function parsePriceMinor(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const n = parseFloat(text.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? rupeesToMinor(n) : undefined;
}

/** Navigates the store's search page in a real browser and extracts rich products via DOM. */
export async function scrapeViaDom(recipe: DomRecipe, query: string, pincode: string, timeoutMs: number): Promise<Product[]> {
  const browser = await getBrowser();
  const ctx = await browser.newContext({ userAgent: UA });
  const page = await ctx.newPage();
  page.setDefaultTimeout(timeoutMs);
  try {
    if (recipe.pincodeStorageKey) {
      const key = recipe.pincodeStorageKey;
      await page.addInitScript(
        ([k, v]) => {
          try {
            (globalThis as unknown as { localStorage: Storage }).localStorage.setItem(k, v);
          } catch {
            /* ignore */
          }
        },
        [key, pincode] as [string, string],
      );
    }
    await page.goto(recipe.url(query, pincode), { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForSelector(recipe.card, { timeout: timeoutMs }).catch(() => undefined);
    if (recipe.settleMs) await page.waitForTimeout(recipe.settleMs);

    const cards: DomCard[] = await page.$$eval(
      recipe.card,
      (els, sel) => {
        // Guarded so an invalid/mismatched selector yields undefined, never throws the scrape.
        const q = (root: Element, s?: string): Element | null => {
          if (!s) return null;
          try {
            return root.querySelector(s);
          } catch {
            return null;
          }
        };
        const txt = (root: Element, s?: string): string | undefined =>
          q(root, s)?.textContent?.trim() || undefined;
        return els.slice(0, 20).map((el) => ({
          name: txt(el, sel.name),
          priceText: txt(el, sel.price),
          mrpText: txt(el, sel.mrp),
          unit: txt(el, sel.unit),
          brand: txt(el, sel.brand),
          ratingText: txt(el, sel.rating),
          image: (q(el, sel.image) as HTMLImageElement | null)?.src,
          href: (el.closest('a') as HTMLAnchorElement | null)?.href ?? (q(el, 'a') as HTMLAnchorElement | null)?.href,
          soldOut: q(el, sel.soldOut) !== null,
        }));
      },
      recipe.sel,
    );

    const out: Product[] = [];
    for (const c of cards) {
      const priceMinor = parsePriceMinor(c.priceText);
      if (!c.name || priceMinor === undefined) continue;
      const mrpMinor = parsePriceMinor(c.mrpText);
      const rating = c.ratingText ? parseFloat(c.ratingText.replace(/[^\d.]/g, '')) : NaN;
      out.push(
        compact({
          id: `${recipe.key}-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
          name: c.name,
          priceMinor,
          unit: c.unit ?? 'unit',
          brand: c.brand,
          size: c.unit,
          mrpMinor: mrpMinor !== undefined && mrpMinor > priceMinor ? mrpMinor : undefined,
          discountMinor: mrpMinor !== undefined && mrpMinor > priceMinor ? mrpMinor - priceMinor : undefined,
          imageUrl: c.image,
          productUrl: c.href,
          rating: Number.isFinite(rating) ? rating : undefined,
          stockStatus: stockStatusOf(c.soldOut ? false : undefined),
        }) as Product,
      );
    }
    return out;
  } finally {
    await ctx.close();
  }
}

/** Turns a DOM recipe into a read-only grocery connector driven by the shared browser. */
export function definePlaywrightGroceryConnector(recipe: DomRecipe): GroceryProviderPort {
  const pincode = process.env.QC_DEFAULT_PINCODE ?? '400001';
  const timeoutMs = Number(process.env.QC_SCRAPE_TIMEOUT_MS ?? 20000);
  return defineConnector<GroceryProviderPort>({
    key: recipe.key,
    domain: 'grocery',
    async health(): Promise<ProviderHealth> {
      try {
        const products = await scrapeViaDom(recipe, 'milk', pincode, timeoutMs);
        return products.length > 0 ? { healthy: true } : { healthy: false, details: 'no products (selectors or location)' };
      } catch (error) {
        return { healthy: false, details: (error as Error).message };
      }
    },
    searchProducts: (query: string) => scrapeViaDom(recipe, query, pincode, timeoutMs),
    async submitOrder(): Promise<SubmittedOrder> {
      throw new Error(`${recipe.key}: order placement is not supported (read-only price scraper)`);
    },
  });
}
