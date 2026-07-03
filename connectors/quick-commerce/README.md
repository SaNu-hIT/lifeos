# @lifeos/connector-quick-commerce

Grocery price connectors for India's quick-commerce platforms:
**Blinkit, Zepto** (live via a real browser) and **Swiggy Instamart, JioMart** (mobile JSON API /
browser location handshake).

Each implements the same `GroceryProviderPort`, so `grocery.compare_prices` / `grocery.check_price`
fan out over all of them automatically (one column per store). They are **read-only** — they scrape
prices and never place orders (`submitOrder` throws).

> BigBasket and Flipkart Minutes were removed — BigBasket hard-blocks with 403 anti-bot even in a
> real browser, and Flipkart Minutes is low-value/brittle (general Flipkart markup, thin coverage).

## Reliability contract

- No credentials → `health()` is unhealthy and `searchProducts()` throws → the comparison falls
  back to the **last cached price** for that store (never crashes the whole comparison).
- A failed/empty live response is likewise treated as unreliable → cache fallback.

## Configuration (env)

Secrets are **never** hardcoded. Per platform, set the cookie/token captured from a logged-in
session; shared settings apply to all:

| platform | credential env | optional base-URL override |
|---|---|---|
| Blinkit | `BLINKIT_COOKIE` | `BLINKIT_BASE_URL` |
| Zepto | `ZEPTO_COOKIE` | `ZEPTO_BASE_URL` |
| Instamart | `SWIGGY_INSTAMART_COOKIE`, `SWIGGY_STORE_ID`, `SWIGGY_LATLNG` | `SWIGGY_INSTAMART_BASE` |
| JioMart | `JIOMART_COOKIE` | `JIOMART_MOBILE_BASE` |

Shared: `QC_DEFAULT_PINCODE` (default `400001`), `QC_PROXY_URL` (residential proxy, applied via
undici when set).

## ⚠️ Endpoints/params/field-paths are UNVERIFIED seeds

The base URLs, request params, and JSON field paths were **seeded from the `shoppingassist` mock
project**, not confirmed against the live APIs. Every unverified spot is marked
`// TODO(verify-live)`. Parsers are defensive (return `[]` on an unexpected shape), so a wrong guess
degrades to "no results / cache fallback" rather than crashing — but real data requires the
verification below.

## Phase C — per-platform verification runbook

For each platform:

1. Log into the platform's web app; open **DevTools → Network → Fetch/XHR**; run a product search.
2. Find the search request that returns JSON. Record: **URL + method**, required **query params**
   (query, lat/lng or pincode, storeId, page/limit), request **headers**, and the **cookie/token**
   names. Update `src/platforms/<platform>.ts` `buildSearch()` accordingly.
3. Copy a real response body; map each rich field's **JSON path** in that file's `parse*()` (update
   the `pickArray` paths and field keys).
4. Put the real cookie/token in the env var above; add a probe (below) to confirm live data.
5. Note any anti-bot needs (residential proxy, TLS/JA3, session refresh cadence) here.

### Probe (once real values are in)

```
BLINKIT_COOKIE='…' QC_DEFAULT_PINCODE=560001 \
  node -e "import('@lifeos/connector-quick-commerce').then(async m => \
    console.log(await m.createBlinkitConnector().searchProducts('milk')))"
```

## Mobile-API capture runbook (Instamart, JioMart)

Their **web** is location-gated (probed: no products without a delivery-location handshake). Two
options: (a) automate the browser location handshake — no credentials — or (b) use their **mobile
app** JSON APIs, which are far less protected (Instamart's `/api/instamart/search/v2` is confirmed
reachable, HTTP 200). This runbook covers (b): the endpoints need session params (cookie/token,
resolved `storeId`, device/lat-lng headers) **captured from a real app session** — they can't be
fabricated. One-time capture per platform; the connector code already consumes them via env.

### Capture setup (once)

1. **Device**: a physical Android phone, or an Android emulator (Android Studio AVD, *Google APIs*
   image — not Play-store — so it's rootable).
2. **Proxy**: install [mitmproxy](https://mitmproxy.org) (or HTTP Toolkit, which automates most of
   the below). Start `mitmweb`; set the phone's Wi-Fi proxy to your machine; install the mitmproxy
   CA cert on the device.
3. **SSL unpinning** (apps reject the proxy cert otherwise): rooted device/emulator +
   [`frida`](https://frida.re) with `objection --gadget <pkg> explore` → `android sslpinning disable`,
   or use a pre-patched APK. HTTP Toolkit ships a Frida script that does this for you.

### Per app — what to record

Open the app, **set the delivery location to your pincode (682023)**, search a product (e.g. "milk"),
and in mitmproxy find the search request that returns product JSON. Record and drop into env:

| platform | endpoint (base) | env vars to fill |
|---|---|---|
| Instamart | `swiggy.com/api/instamart/search/v2` ✅ confirmed | `SWIGGY_INSTAMART_COOKIE`, `SWIGGY_STORE_ID`, `SWIGGY_LATLNG` (`9.9312,76.2673`), `SWIGGY_UA` |
| JioMart | app search host (Algolia-backed) | `JIOMART_MOBILE_BASE`, `JIOMART_COOKIE`, `JIOMART_UA` |

For each, capture: the exact **URL + method**, all **request headers** (esp. auth/token, device id,
lat-lng/matcher), any **POST body**, and a sample **response body**. Then map the response's JSON
paths to the rich `Product` in that platform's `parse*()` (each is marked `TODO(verify-capture)`).

### Confirm

```
SWIGGY_INSTAMART_COOKIE='…' SWIGGY_STORE_ID='…' SWIGGY_LATLNG='9.9312,76.2673' \
  node -e "import('@lifeos/connector-quick-commerce').then(async m => \
    console.log(await m.createInstamartConnector().searchProducts('milk')))"
```

> ⚠️ Captured cookies/tokens **expire** (typically hours–days) and are IP/location-bound. Plan to
> refresh them, and keep them in env/secrets — never commit. If a token dies, the connector goes
> unhealthy and the comparison falls back to cache automatically.

## Tests

`pnpm --filter @lifeos/connector-quick-commerce test` — fixture-driven parser tests (no network) +
the read-only grocery contract for all six.
