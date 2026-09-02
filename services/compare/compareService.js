/**
 * Comparison orchestrator.
 *
 *   query
 *     -> run every registered scraper concurrently (isolated failures)
 *     -> normalize each raw product into the canonical shape
 *     -> drop irrelevant results (relevance scoring)
 *     -> dedupe within a platform
 *     -> group same-product / same-variant results
 *     -> sort every group ascending by price, flag the cheapest
 *     -> assemble a structured payload (also consumed later by the Python advisor)
 *
 * All scraping / parsing / matching / sorting happens here in Node. No LLM.
 */

import { createScrapers } from "./scrapers/registry.js";
import { normalizeProduct } from "./normalize.js";
import {
  parseQueryIntent,
  relevanceScore,
  RELEVANCE_THRESHOLD,
  groupProducts,
} from "./matching.js";
import { getCached, setCached } from "./cache.js";

const PER_SCRAPER_BUDGET_MS = 35_000;

/** Map noisy low-level navigation errors to something a user can understand. */
const friendlyError = (message = "") => {
  const m = message.toLowerCase();
  if (m.includes("timed out") || m.includes("timeout")) {
    return "Source did not respond in time (it may be blocking automated access)";
  }
  if (
    m.includes("err_invalid_response") ||
    m.includes("err_http2") ||
    m.includes("err_connection") ||
    m.includes("net::")
  ) {
    return "Source refused the connection (likely bot protection)";
  }
  if (m.includes("blocked navigation")) return "Blocked an unexpected redirect target";
  return message.length > 140 ? `${message.slice(0, 137)}...` : message;
};

const withTimeout = (promise, ms, onTimeoutMessage) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(onTimeoutMessage)), ms).unref?.()
    ),
  ]);

const dedupeWithinPlatform = (products) => {
  const seen = new Set();
  const out = [];
  for (const product of products) {
    const key = product.productUrl || `${product.platform}:${product.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(product);
  }
  return out;
};

export const runComparison = async (rawQuery, { logger, useCache = true } = {}) => {
  const query = rawQuery.trim();
  const log = logger || (() => {});

  if (useCache) {
    const cached = getCached(query);
    if (cached) {
      log("Served from cache");
      return { ...cached, meta: { ...cached.meta, cached: true } };
    }
  }

  const startedAt = Date.now();
  const intent = parseQueryIntent(query);
  const scrapers = createScrapers();

 const settled = [];

for (const scraper of scrapers) {
  const sourceStart = Date.now();

  try {
    const result = await withTimeout(
      scraper.search(query, { logger: log }),
      PER_SCRAPER_BUDGET_MS,
      `${scraper.displayName} timed out`
    );

    settled.push({
      status: "fulfilled",
      value: {
        ...result,
        displayName: scraper.displayName,
        elapsedMs: Date.now() - sourceStart,
      },
    });
  } catch (err) {
    const message = err?.message || "Unknown scraper error";

    settled.push({
      status: "fulfilled",
      value: {
        platform: scraper.platform,
        displayName: scraper.displayName,
        error: message,
        elapsedMs: Date.now() - sourceStart,
      },
    });
  }
}

  const sources = [];
  let allProducts = [];

  for (const outcome of settled) {
    // allSettled + internal catch means this is always "fulfilled".
    const value = outcome.status === "fulfilled" ? outcome.value : { platform: "unknown", error: "rejected" };

    if (value.error) {
      sources.push({
        platform: value.platform,
        displayName: value.displayName,
        status: "failed",
        count: 0,
        message: friendlyError(value.error),
        elapsedMs: value.elapsedMs ?? null,
      });
      continue;
    }

    const normalized = dedupeWithinPlatform(
      (value.products || [])
        .map((raw) => normalizeProduct(raw, value.platform))
        .filter(Boolean)
    );

    const relevant = normalized
      .map((product) => ({ product, score: relevanceScore(product, intent) }))
      .filter(({ score }) => score >= RELEVANCE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .map(({ product, score }) => ({ ...product, relevance: Number(score.toFixed(3)) }));

    allProducts = allProducts.concat(relevant);

    sources.push({
      platform: value.platform,
      displayName: value.displayName,
      status: relevant.length ? "success" : "empty",
      count: relevant.length,
      message: relevant.length
        ? null
        : normalized.length
          ? "No results matched your search closely enough"
          : "No results returned (source may be blocking automated access)",
      elapsedMs: value.elapsedMs ?? null,
    });
  }

  const groups = groupProducts(allProducts);

  const pricedProducts = allProducts
    .filter((p) => typeof p.price === "number")
    .sort((a, b) => a.price - b.price);

  const cheapestOverall = pricedProducts[0]
    ? {
        id: pricedProducts[0].id,
        platform: pricedProducts[0].platform,
        title: pricedProducts[0].title,
        price: pricedProducts[0].price,
        currency: pricedProducts[0].currency,
        productUrl: pricedProducts[0].productUrl,
      }
    : null;

  const payload = {
    query,
    normalizedQuery: intent.canonical,
    intent: { brand: intent.brand, specs: intent.specs, tokens: [...intent.tokens] },
    products: [...pricedProducts, ...allProducts.filter((p) => typeof p.price !== "number")],
    groups,
    cheapestOverall,
    sources,
    meta: {
      cached: false,
      tookMs: Date.now() - startedAt,
      totalResults: allProducts.length,
      groupCount: groups.length,
      sourcesSucceeded: sources.filter((s) => s.status === "success").length,
      sourcesFailed: sources.filter((s) => s.status === "failed").length,
    },
  };

  if (useCache && allProducts.length > 0) {
    setCached(query, payload);
  }

  return payload;
};
