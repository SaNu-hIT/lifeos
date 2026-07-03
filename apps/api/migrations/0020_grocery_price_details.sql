-- 0020_grocery_price_details — enrich the cross-store price cache with the extra
-- product info the scrapers now capture alongside price: average rating, how many
-- ratings it's based on, and whether the item was in stock at scrape time. All
-- nullable: a store that doesn't expose a field just leaves it null, and older cache
-- rows keep working unchanged (backfill not required — a null rating/availability is
-- treated as "unknown" by grocery.compare_prices).

alter table grocery.price_cache
  add column if not exists rating numeric(2, 1),
  add column if not exists rating_count integer,
  add column if not exists available boolean;
