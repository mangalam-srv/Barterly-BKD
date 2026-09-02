import { FlipkartReviewProvider } from "./flipkartReviewProvider.js";

/**
 * Review-source registry + short-lived cache.
 *
 * Currently only Flipkart product pages can be read for review text from a
 * datacenter IP (Amazon / Myntra block automated access — see Prompt 1). The
 * architecture is provider-based so more sources can be added without touching
 * callers: add a provider class and one line here.
 */
const PROVIDERS = [new FlipkartReviewProvider()];

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE = 200;
const cache = new Map();

const cacheKey = (url) => url.split("?")[0].toLowerCase();

const getCached = (url) => {
  const entry = cache.get(cacheKey(url));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(cacheKey(url));
    return null;
  }
  return entry.value;
};

const setCached = (url, value) => {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(cacheKey(url), { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

/** All hosts any provider can read — used for endpoint URL validation. */
export const supportedReviewHosts = () => [
  ...new Set(PROVIDERS.flatMap((p) => p.allowedHosts)),
];

export const supportedReviewPlatforms = () => PROVIDERS.map((p) => p.platform);

/**
 * Fetch review text for a product page URL.
 * @returns {Promise<{ reviews: string[], platform: string|null, cached: boolean, note?: string }>}
 */
export const getReviews = async (productUrl) => {
  const cached = getCached(productUrl);
  if (cached) return { ...cached, cached: true };

  const provider = PROVIDERS.find((p) => p.canHandle(productUrl));
  if (!provider) {
    return {
      reviews: [],
      platform: null,
      cached: false,
      note: "review text is not available for this store",
    };
  }

  const result = await provider.fetchReviews(productUrl);
  const value = { reviews: result.reviews, platform: result.platform, note: result.note };
  // Cache successes and "nothing found" alike (avoid hammering the page).
  setCached(productUrl, value);
  return { ...value, cached: false };
};
