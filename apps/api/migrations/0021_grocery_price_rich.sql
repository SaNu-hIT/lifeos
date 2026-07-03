-- 0021_grocery_price_rich — carry the richer product info the JSON-API connectors return
-- (brand, MRP, discount, delivery ETA, image, product URL, fine-grained stock status)
-- through the cross-store price cache, so a cache-fallback comparison shows the same rich
-- fields a live scrape would. All nullable: a store/API that doesn't expose a field leaves
-- it null, and older cache rows keep working unchanged.

alter table grocery.price_cache
  add column if not exists brand text,
  add column if not exists mrp_minor integer,
  add column if not exists discount_minor integer,
  add column if not exists delivery_eta_minutes integer,
  add column if not exists image_url text,
  add column if not exists product_url text,
  add column if not exists stock_status text;
