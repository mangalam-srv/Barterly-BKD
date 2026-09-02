/**
 * Tiny in-memory TTL cache for comparison results.
 *
 * The project has no Redis / cache layer, so this is deliberately minimal: a Map
 * with per-entry expiry and a hard size cap. Its only job is to stop the same
 * query from re-driving Playwright a few seconds apart.
 */

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ENTRIES = 100;

const store = new Map();

export const cacheKey = (query) => query.trim().toLowerCase().replace(/\s+/g, " ");

export const getCached = (query) => {
  const key = cacheKey(query);
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  // Refresh LRU ordering.
  store.delete(key);
  store.set(key, entry);
  return entry.value;
};

export const setCached = (query, value, ttlMs = DEFAULT_TTL_MS) => {
  const key = cacheKey(query);
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
};

export const clearCache = () => store.clear();
