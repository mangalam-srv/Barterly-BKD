/**
 * Deterministic same-product matching and grouping.
 *
 * Prompt 1 rule: NO LLM here. Matching is done purely from parsed brand / model
 * tokens / variant specs so results are reproducible and explainable.
 */

import { canonicalizeText, extractSpecs, extractModelTokens, detectBrand } from "./normalize.js";

const jaccard = (a, b) => {
  if (!a.size && !b.size) return 1;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

/** Build the structured "intent" of the user's raw search string. */
export const parseQueryIntent = (query) => {
  const brand = detectBrand(query);
  const specs = extractSpecs(query);
  const tokens = extractModelTokens(query, brand);
  return { raw: query, canonical: canonicalizeText(query), brand, specs, tokens: new Set(tokens) };
};

// Tokens that signal the result is an accessory, not the product itself.
const ACCESSORY_TOKENS = new Set([
  "case",
  "cases",
  "cover",
  "covers",
  "tempered",
  "glass",
  "guard",
  "protector",
  "screenguard",
  "screen-guard",
  "charger",
  "cable",
  "adapter",
  "skin",
  "pouch",
  "holder",
  "stand",
  "mount",
  "strap",
  "sleeve",
  "bumper",
  "flip",
]);

/**
 * Relevance score in [0,1] between a normalized product and the query intent.
 * Products below RELEVANCE_THRESHOLD are dropped so a search for "iPhone 15
 * 128GB" never surfaces phone cases, chargers, or the 256GB variant.
 *
 * Signal:
 *   - brand match/conflict          (brand conflict is an instant fail)
 *   - query-token coverage          (are the important words present?)
 *   - token precision / Jaccard     (is the listing focused on the query?)
 *   - variant spec agreement        (storage conflict is near-disqualifying)
 *   - accessory-word penalty
 */
export const relevanceScore = (product, intent) => {
  if (intent.brand && product.brand && product.brand !== intent.brand) {
    return 0.05;
  }

  const productTokens = new Set(product.modelTokens);

  let matchedKeyTokens = 0;
  for (const tok of intent.tokens) {
    if (productTokens.has(tok)) matchedKeyTokens += 1;
  }
  // A brand match alone is not enough — the model words have to show up too.
  if (intent.tokens.size > 0 && matchedKeyTokens === 0) return 0.1;

  let score = 0.15;
  if (intent.brand && product.brand === intent.brand) score += 0.25;

  const coverage = intent.tokens.size ? matchedKeyTokens / intent.tokens.size : 1;
  score += 0.35 * coverage;
  score += 0.25 * jaccard(intent.tokens, productTokens);

  for (const key of Object.keys(intent.specs)) {
    if (!product.specs[key]) continue;
    if (product.specs[key] === intent.specs[key]) {
      score += 0.1;
    } else {
      score -= key === "storage" ? 0.8 : 0.5;
    }
  }

  for (const tok of productTokens) {
    if (ACCESSORY_TOKENS.has(tok) && !intent.tokens.has(tok)) {
      score -= 0.6;
      break;
    }
  }

  return Math.max(0, Math.min(1, score));
};

export const RELEVANCE_THRESHOLD = 0.35;

/** Variant fingerprint — products only group when these specs agree. */
const VARIANT_KEYS = ["storage", "ram", "color", "size", "screen"];

const variantKey = (product) =>
  VARIANT_KEYS.map((k) => `${k}:${product.specs[k] || "?"}`).join("|");

const modelSignature = (product) => {
  const tokens = [...product.modelTokens].sort();
  return `${product.brand || "?"}::${tokens.join(" ")}`;
};

/**
 * Group products that are the same product / same variant.
 *
 * Two products join the same group when:
 *   1. same brand, AND
 *   2. same variant specs (storage + ram + colour + size), AND
 *   3. model-token similarity >= MODEL_SIMILARITY (defends against unrelated
 *      products that happen to share a capacity).
 */
export const MODEL_SIMILARITY = 0.7;

// Words that change WHICH product this is, not just a spec of it. Two titles
// that disagree on any of these are never the same product.
const MODEL_DEFINING_TOKENS = new Set([
  "pro",
  "plus",
  "max",
  "ultra",
  "mini",
  "air",
  "lite",
  "neo",
  "fe",
  "se",
  "prime",
  "note",
  "edge",
  "fold",
  "flip",
  "active",
]);

const definingConflict = (aTokens, bTokens) => {
  for (const tok of MODEL_DEFINING_TOKENS) {
    if (aTokens.has(tok) !== bTokens.has(tok)) return true;
  }
  return false;
};

export const groupProducts = (products) => {
  const groups = [];

  for (const product of products) {
    const pTokens = new Set(product.modelTokens);
    let placed = false;

    for (const group of groups) {
      if (group.brand !== (product.brand || null)) continue;
      if (group.variantKey !== variantKey(product)) continue;
      if (definingConflict(group.fullTokenSet, pTokens)) continue;
      const similarity = jaccard(group.tokenSet, pTokens);
      if (similarity >= MODEL_SIMILARITY) {
        group.products.push(product);
        // Keep the token set as the intersection so the group stays tight.
        group.tokenSet = new Set([...group.tokenSet].filter((t) => pTokens.has(t)));
        for (const t of pTokens) group.fullTokenSet.add(t);
        placed = true;
        break;
      }
    }

    if (!placed) {
      groups.push({
        brand: product.brand || null,
        variantKey: variantKey(product),
        tokenSet: new Set(pTokens),
        fullTokenSet: new Set(pTokens),
        signature: modelSignature(product),
        products: [product],
      });
    }
  }

  return groups.map(finalizeGroup).sort((a, b) => {
    // Multi-source groups first, then by cheapest price.
    const aMulti = a.platforms.length > 1 ? 1 : 0;
    const bMulti = b.platforms.length > 1 ? 1 : 0;
    if (aMulti !== bMulti) return bMulti - aMulti;
    return (a.cheapest?.price ?? Infinity) - (b.cheapest?.price ?? Infinity);
  });
};

const buildGroupLabel = (products) => {
  // Longest title tends to be the most descriptive; trim to something readable.
  const longest = products.reduce((a, b) => (b.title.length > a.title.length ? b : a));
  return longest.title.length > 90 ? `${longest.title.slice(0, 87)}…` : longest.title;
};

const finalizeGroup = (group) => {
  const priced = group.products
    .filter((p) => typeof p.price === "number")
    .sort((a, b) => a.price - b.price);
  const unpriced = group.products.filter((p) => typeof p.price !== "number");
  const ordered = [...priced, ...unpriced];

  const cheapest = priced[0]
    ? {
        id: priced[0].id,
        platform: priced[0].platform,
        price: priced[0].price,
        productUrl: priced[0].productUrl,
      }
    : null;

  const prices = priced.map((p) => p.price);
  const platforms = [...new Set(group.products.map((p) => p.platform))];

  return {
    key: `${group.signature}||${group.variantKey}`,
    label: buildGroupLabel(group.products),
    brand: group.brand,
    specs: commonSpecs(group.products),
    platforms,
    productCount: group.products.length,
    products: ordered.map((p, index) => ({
      ...p,
      isBestPrice: cheapest ? p.id === cheapest.id : false,
      priceRank: typeof p.price === "number" ? index + 1 : null,
    })),
    cheapest,
    priceRange: prices.length
      ? { min: prices[0], max: prices[prices.length - 1], spread: prices[prices.length - 1] - prices[0] }
      : null,
  };
};

const commonSpecs = (products) => {
  const result = {};
  for (const key of VARIANT_KEYS) {
    const values = new Set(products.map((p) => p.specs[key]).filter(Boolean));
    if (values.size === 1) result[key] = [...values][0];
  }
  return result;
};
