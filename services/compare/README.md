# AI Compare – price comparison engine

Node/Express + Playwright. **No Python, no LLM** in this layer — everything here
is deterministic so results are reproducible and explainable. The Python AI
service (Prompt 2) will consume the structured output of `runComparison()`.

## Flow

```
GET /api/v1/compare?q=...
  → routes/compare.routes.js         (rate limiting)
  → controllers/compare.controller.js (validate + sanitize input)
  → services/compare/compareService.js  runComparison()
        ├─ scrapers/registry.js        which stores are enabled
        ├─ scrapers/*Scraper.js        Playwright scrape → raw products
        ├─ normalize.js                raw → canonical CompareProduct
        ├─ matching.js                 relevance filter + same-variant grouping
        └─ (sort every group ascending by price, flag cheapest)
  → ApiResponse { query, products, groups, cheapestOverall, sources, meta }
```

## Files

| File | Responsibility |
|------|----------------|
| `browserManager.js` | One shared headless Chromium; hands out isolated contexts; auto-closes when idle |
| `scrapers/baseScraper.js` | Page lifecycle, navigation + retry, timeouts, resource blocking, URL allow-listing, error wrapping |
| `scrapers/amazonScraper.js` / `flipkartScraper.js` / `myntraScraper.js` | Per-store `buildSearchUrl()` + `extractProducts()` only |
| `scrapers/registry.js` | The list of enabled stores (+ `COMPARE_SOURCES` / `COMPARE_MAX_RESULTS_PER_SOURCE` env overrides) |
| `normalize.js` | Price/rating/review parsing, spec extraction, `normalizeProduct()` |
| `matching.js` | `relevanceScore()`, `groupProducts()` |
| `cache.js` | 10-minute in-memory TTL cache keyed by normalized query |
| `compareService.js` | Orchestrates all of the above with per-source failure isolation |

## Adding a new store

1. `scrapers/myshopScraper.js`:

   ```js
   import { BaseScraper } from "./baseScraper.js";
   export class MyShopScraper extends BaseScraper {
     platform = "myshop";
     displayName = "MyShop";
     allowedHosts = ["myshop.com"];
     buildSearchUrl(q) { return `https://www.myshop.com/search?q=${encodeURIComponent(q)}`; }
     async extractProducts(page) { /* return [{ title, productUrl, price, ... }] */ }
   }
   ```

2. Add one entry to `SCRAPER_CLASSES` in `registry.js`.

Nothing else changes — normalization, matching, sorting and the API all work
off the canonical shape.

## Same-product matching (deterministic)

1. **Query intent** (`parseQueryIntent`): brand + variant specs (storage / RAM /
   colour / size / screen) + model tokens are parsed from the raw search string.
2. **Relevance filter** (`relevanceScore`, threshold `0.35`): each normalized
   product is scored on brand agreement, model-token coverage + precision
   (Jaccard), variant-spec agreement, and an accessory-word penalty.
   A **storage conflict is near-disqualifying** (so `128GB` never matches a
   `256GB` query), a **brand conflict is an instant fail**, and a brand-only
   match with zero model-token overlap is rejected.
3. **Grouping** (`groupProducts`): products join a group only when brand +
   variant specs match, no *model-defining* token differs (`pro`, `plus`,
   `max`, `ultra`, `fe`, …), and model-token similarity ≥ `0.7`.
4. Each group is sorted ascending by numeric price; the first priced item is
   flagged `isBestPrice` and surfaced as `group.cheapest`. The cheapest across
   all groups is `cheapestOverall`.

## Output shape (also the Python advisor's input, Prompt 2)

```jsonc
{
  "query": "iPhone 15 128GB",
  "normalizedQuery": "iphone 15 128gb",
  "intent": { "brand": "apple", "specs": { "storage": "128GB" }, "tokens": ["iphone","15"] },
  "products": [ /* CompareProduct[], priced first, ascending */ ],
  "groups":   [ /* CompareGroup[] with .cheapest / .priceRange / .products */ ],
  "cheapestOverall": { "id", "platform", "title", "price", "currency", "productUrl" },
  "sources": [ { "platform", "displayName", "status", "count", "message", "elapsedMs" } ],
  "meta": { "cached", "tookMs", "totalResults", "groupCount", "sourcesSucceeded", "sourcesFailed" }
}
```

Each `CompareProduct` carries `title, brand, price, originalPrice,
discountPercent, currency, image, productUrl, platform, rating, reviewCount,
availability, deliveryInfo, category, specs, modelNumber, variant` — enough for
the future per-product advisor chatbot without re-scraping.

## Consumers (added in Prompt 3)

- **`POST /internal/compare-search`** (`routes/internal.routes.js`) — the scoped
  operation the Python AI advisor calls to run a live comparison. Key- or
  loopback-gated (`middleware/internalAuth.middleware.js`); accepts `{ query }`
  only (never a URL); returns a slimmed version of the payload above. This is how
  the advisor's "compare with X" / "find an alternative" tool works **without a
  second scraper**.

- **`reviews/`** — extensible review-text architecture. `BaseReviewProvider`
  (page lifecycle, host allow-list, graceful failure) + one provider per store
  (`FlipkartReviewProvider` reads the `/product-reviews/` page). `reviewService.js`
  registers providers and caches results 30 min. Surfaced at
  `GET /api/v1/compare/reviews?url=`. Amazon/Myntra have no provider (blocked from
  datacenter IPs) — documented, not faked.

## Manual tests

```bash
node services/compare/__tests__/pipeline.manual.mjs        # deterministic, no network
node services/compare/__tests__/live.manual.mjs "iPhone 15 128GB"   # real scrape
```
