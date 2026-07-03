// The seam between "how to get product data out of Zepto's web frontend" and the
// connector's retry/cache/health logic — same shape as @lifeos/connector-blinkit-live's
// page-driver.ts. Production uses PlaywrightPageDriver (a real headless browser);
// tests inject a fake driver over recorded fixtures so CI never depends on the live site.

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
  search(query: string): Promise<ScrapedProduct[]>;
  close(): Promise<void>;
}

export interface PlaywrightPageDriverOptions {
  headless?: boolean;
  navigationTimeoutMs?: number;
}

/**
 * Real scraper for zepto.com's web frontend, via headless Chromium (Playwright).
 *
 * Unlike Blinkit, zepto.com/search returns real product results without needing a
 * delivery-location bootstrap step first (confirmed live while building this — a
 * plain search request already renders priced products for a default location), so
 * this driver skips the location dance Blinkit's needs. If Zepto starts requiring
 * one, add the same addInitScript-based seeding used in the Blinkit driver here.
 *
 * SELECTOR CAVEAT: the selectors below were confirmed against the live site
 * (zepto.com/search?query=milk). Zepto's markup uses semantic `data-slot-id`
 * attributes (ProductName, PackSize, EdlpPrice) rather than only Tailwind utility
 * classes, which should make these somewhat more durable than Blinkit's — but they
 * are still not a stable public API and can change without notice. If `search()`
 * starts returning zero results or throwing, health() reports unhealthy, the
 * Connector Registry fails over to another store, and compare_prices falls back to
 * the price cache (skills/grocery/src/tools.ts `compareOneItem`) rather than showing
 * broken data — re-run the DOM inspection this file's selectors were derived from and
 * update the selector constants below.
 */
export class PlaywrightPageDriver implements PageDriver {
  private browserPromise: ReturnType<typeof this.launch> | undefined;
  private readonly headless: boolean;
  private readonly navigationTimeoutMs: number;

  constructor(options: PlaywrightPageDriverOptions = {}) {
    this.headless = options.headless ?? true;
    this.navigationTimeoutMs = options.navigationTimeoutMs ?? 15_000;
  }

  private async launch() {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: this.headless });
    const context = await browser.newContext({
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
      await page.goto(`https://www.zepto.com/search?query=${encodeURIComponent(query)}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForSelector(PRODUCT_CARD_SELECTOR, { timeout: this.navigationTimeoutMs });
      return await page.$$eval(
        PRODUCT_CARD_SELECTOR,
        (cards, sel) =>
          cards
            .map((card) => {
              const name = card.querySelector(sel.name)?.textContent?.trim();
              const packText = card.querySelector(sel.pack)?.textContent?.trim();
              // First price span is the current (possibly discounted) price; a
              // second span, if present, is the struck-through original price.
              const priceText = card.querySelectorAll(sel.price)[0]?.textContent?.trim();
              if (!name || !priceText) return null;
              const priceMinor = Math.round(parseFloat(priceText.replace(/[^\d.]/g, '')) * 100);
              if (!Number.isFinite(priceMinor)) return null;
              const unitMatch = packText?.match(/\(([^)]+)\)/);
              const unit = unitMatch?.[1] ?? packText ?? 'unit';
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
          pack: PACK_SELECTOR,
          price: PRICE_SELECTOR,
          rating: RATING_SELECTOR,
          ratingCount: RATING_COUNT_SELECTOR,
          outOfStock: OUT_OF_STOCK_SELECTOR,
        },
      );
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    if (!this.browserPromise) return;
    const { browser } = await this.browserPromise;
    await browser.close();
    this.browserPromise = undefined;
  }
}

// Selectors confirmed live — see the SELECTOR CAVEAT above.
const PRODUCT_CARD_SELECTOR = 'a[href^="/pn/"]';
const NAME_SELECTOR = '[data-slot-id="ProductName"] span';
const PACK_SELECTOR = '[data-slot-id="PackSize"] span';
const PRICE_SELECTOR = '[data-slot-id="EdlpPrice"] span';
// Best-effort extras — NOT confirmed against the live DOM the way name/pack/price were
// (see SELECTOR CAVEAT). Zepto tends to use semantic data-slot-id hooks, so these guess
// at the same convention; a wrong guess degrades to "no rating / unknown stock" rather
// than breaking the scrape. Update if the extras come back consistently empty.
const RATING_SELECTOR = '[data-slot-id="ProductRating"], [data-slot-id="Rating"]';
const RATING_COUNT_SELECTOR = '[data-slot-id="RatingCount"], [data-slot-id="ReviewCount"]';
const OUT_OF_STOCK_SELECTOR = '[data-slot-id="OutOfStock"], [data-slot-id="SoldOut"]';
