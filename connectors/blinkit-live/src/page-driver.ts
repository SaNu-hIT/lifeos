// The seam between "how to get product data out of Blinkit's web frontend" and the
// connector's retry/cache/health logic. Production uses PlaywrightPageDriver (a real
// headless browser — plain HTTP is blocked outright, see class docs below); tests
// inject a fake driver over recorded fixtures so CI never depends on the live site.

export interface ScrapedProduct {
  name: string;
  priceMinor: number;
  unit: string;
  /** Average star rating shown on the card, if present. */
  rating?: number;
  /** How many ratings the average is based on, if present. */
  ratingCount?: number;
  /** `false` when the card is flagged out of stock; `undefined` when the site gives no
   *  stock signal (treated as available downstream). */
  available?: boolean;
}

export interface PageDriver {
  /** Search the store for `query` and return whatever product cards were found. */
  search(query: string): Promise<ScrapedProduct[]>;
  close(): Promise<void>;
}

export interface PlaywrightPageDriverOptions {
  /** Delivery pincode to bootstrap the session location with (Blinkit requires one
   *  to show prices). Defaults to a Bangalore pincode — override per deployment. */
  pincode?: string;
  headless?: boolean;
  navigationTimeoutMs?: number;
}

const DEFAULT_PINCODE = '560001';

/**
 * Real scraper for blinkit.com's web frontend, via headless Chromium (Playwright).
 *
 * Plain `fetch` does not work here: an unauthenticated static request to
 * blinkit.com/s/?q=... returns HTTP 403 immediately (verified while building this —
 * Cloudflare blocks non-browser clients before the app layer sees the request), and
 * the results are rendered client-side by a JS SPA that returns nothing useful in
 * server HTML anyway. A real browser context is the minimum viable approach.
 *
 * SELECTOR CAVEAT: the CSS selectors below were confirmed against the live site
 * (blinkit.com/s/?q=milk, no auth/session needed) — a search for "milk" returned
 * real product cards (name, weight, price) using these exact selectors. They rely on
 * Tailwind utility classes (`tw-text-300 tw-font-semibold tw-line-clamp-2`, etc.) and
 * a `role="button"` + `data-pf="reset"` combination for the card container, since the
 * page has no stable `data-testid` hooks. Tailwind class names are NOT a stable public
 * API — a future Blinkit deploy can change them without notice, at which point
 * `search()` will start returning zero results or throwing. That is the designed
 * failure mode: `health()` reports unhealthy, the Connector Registry fails over to
 * another store, and `compare_prices` falls back to the price cache (see
 * skills/grocery/src/tools.ts `compareOneItem`) rather than showing broken data. If
 * that starts happening, re-run the DOM inspection this file's selectors were derived
 * from (open devtools on a live Blinkit search, or script it with Playwright) and
 * update `PRODUCT_CARD_SELECTOR`/`NAME_SELECTOR`/`PRICE_SELECTOR`/`UNIT_SELECTOR`.
 */
export class PlaywrightPageDriver implements PageDriver {
  private browserPromise: ReturnType<typeof this.launch> | undefined;
  private readonly pincode: string;
  private readonly headless: boolean;
  private readonly navigationTimeoutMs: number;

  constructor(options: PlaywrightPageDriverOptions = {}) {
    this.pincode = options.pincode ?? DEFAULT_PINCODE;
    this.headless = options.headless ?? true;
    this.navigationTimeoutMs = options.navigationTimeoutMs ?? 15_000;
  }

  private async launch() {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: this.headless });
    const context = await browser.newContext({
      // A realistic UA reduces (but does not eliminate) the chance of being blocked
      // outright; this is not an attempt to defeat bot-detection, just to look like
      // an ordinary browser rather than a bare HTTP client.
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    });
    return { browser, context };
  }

  private async getContext() {
    this.browserPromise ??= this.launch();
    return this.browserPromise;
  }

  async search(query: string): Promise<ScrapedProduct[]> {
    const { context } = await this.getContext();
    const page = await context.newPage();
    page.setDefaultTimeout(this.navigationTimeoutMs);
    try {
      await this.setLocation(page);
      await page.goto(`https://blinkit.com/s/?q=${encodeURIComponent(query)}`, {
        waitUntil: 'domcontentloaded',
      });
      // Product listings load asynchronously after navigation.
      await page.waitForSelector(PRODUCT_CARD_SELECTOR, { timeout: this.navigationTimeoutMs });
      return await page.$$eval(
        PRODUCT_CARD_SELECTOR,
        (cards, sel) =>
          cards
            .map((card) => {
              const name = card.querySelector(sel.name)?.textContent?.trim();
              const priceText = card.querySelector(sel.price)?.textContent?.trim();
              const unit = card.querySelector(sel.unit)?.textContent?.trim() ?? 'unit';
              if (!name || !priceText) return null;
              const priceMinor = Math.round(parseFloat(priceText.replace(/[^\d.]/g, '')) * 100);
              if (!Number.isFinite(priceMinor)) return null;
              // Extra product info — all best-effort: absent nodes just yield undefined.
              const ratingText = card.querySelector(sel.rating)?.textContent?.trim();
              const rating = ratingText ? parseFloat(ratingText.replace(/[^\d.]/g, '')) : NaN;
              const countText = card.querySelector(sel.ratingCount)?.textContent?.trim();
              const ratingCount = countText ? parseInt(countText.replace(/[^\d]/g, ''), 10) : NaN;
              const soldOut =
                card.querySelector(sel.outOfStock) !== null ||
                /out of stock|sold out|notify me/i.test(card.textContent ?? '');
              return {
                name,
                priceMinor,
                unit,
                rating: Number.isFinite(rating) ? rating : undefined,
                ratingCount: Number.isFinite(ratingCount) ? ratingCount : undefined,
                available: soldOut ? false : undefined,
              };
            })
            .filter((p): p is NonNullable<typeof p> => p !== null),
        {
          name: NAME_SELECTOR,
          price: PRICE_SELECTOR,
          unit: UNIT_SELECTOR,
          rating: RATING_SELECTOR,
          ratingCount: RATING_COUNT_SELECTOR,
          outOfStock: OUT_OF_STOCK_SELECTOR,
        },
      );
    } finally {
      await page.close();
    }
  }

  /** Blinkit requires a delivery location before it will show prices. Best-effort:
   *  seed localStorage with a pincode before first navigation; if the site changes
   *  its location-selection flow this needs a real UI interaction here instead. */
  private async setLocation(page: import('playwright').Page): Promise<void> {
    // Runs inside the browser page context, not Node — `window` isn't in this
    // package's (Node) type lib, so it's accessed via a typed globalThis cast.
    await page.addInitScript((pincode: string) => {
      (globalThis as unknown as { localStorage: { setItem(key: string, value: string): void } }).localStorage.setItem(
        'blinkit_pincode',
        pincode,
      );
    }, this.pincode);
  }

  async close(): Promise<void> {
    if (!this.browserPromise) return;
    const { browser } = await this.browserPromise;
    await browser.close();
    this.browserPromise = undefined;
  }
}

// Selectors confirmed live — see the SELECTOR CAVEAT above. Centralized here so a
// future fix only needs to update this block, not the scraping logic.
const PRODUCT_CARD_SELECTOR = 'div[role="button"][data-pf="reset"]';
const NAME_SELECTOR = '.tw-text-300.tw-font-semibold.tw-line-clamp-2';
const PRICE_SELECTOR = '.tw-text-200.tw-font-semibold';
const UNIT_SELECTOR = '.tw-text-200.tw-font-medium.tw-line-clamp-1';
// Best-effort extras — NOT confirmed against the live DOM the way name/price/unit were
// (see SELECTOR CAVEAT). If a card lacks these nodes the field is simply omitted, so a
// wrong guess degrades to "no rating / unknown stock" rather than breaking the scrape.
// Blinkit renders a rating pill and, on unavailable items, a greyed card with a "Notify
// me" affordance instead of "Add"; update these if the extras come back empty.
const RATING_SELECTOR = '[class*="rating"], .tw-text-050.tw-font-semibold';
const RATING_COUNT_SELECTOR = '[class*="rating"] + *, [class*="review"]';
const OUT_OF_STOCK_SELECTOR = '[class*="sold-out"], [class*="out-of-stock"]';
