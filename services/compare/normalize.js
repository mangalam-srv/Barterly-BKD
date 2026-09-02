/**
 * Pure, deterministic helpers for turning messy scraped strings into a single
 * normalized product representation. No network, no browser, no LLM — this is
 * all plain parsing so it stays fast and testable.
 */

export const KNOWN_BRANDS = [
  "apple",
  "samsung",
  "oneplus",
  "xiaomi",
  "redmi",
  "poco",
  "realme",
  "vivo",
  "oppo",
  "motorola",
  "nothing",
  "google",
  "asus",
  "lenovo",
  "hp",
  "dell",
  "acer",
  "msi",
  "nike",
  "adidas",
  "puma",
  "reebok",
  "woodland",
  "boat",
  "sony",
  "jbl",
  "noise",
];

const COLOR_WORDS = [
  "black",
  "white",
  "blue",
  "green",
  "red",
  "pink",
  "purple",
  "violet",
  "yellow",
  "orange",
  "gold",
  "silver",
  "grey",
  "gray",
  "graphite",
  "titanium",
  "midnight",
  "starlight",
  "lavender",
  "cream",
  "coral",
  "teal",
  "navy",
  "beige",
  "bronze",
  "rose",
  "mint",
  "sky",
  "amber",
  "phantom",
  "cobalt",
  "sierra",
  "pacific",
];

const CURRENCY_SYMBOLS = { "₹": "INR", rs: "INR", inr: "INR", $: "USD" };

/**
 * Parse a price string like "₹1,29,900", "Rs. 47999.00", "1299" into a Number.
 * Returns null when no sensible numeric value can be extracted.
 */
export const parsePrice = (input) => {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) && input > 0 ? input : null;

  const text = String(input).trim();
  if (!text) return null;

  // Grab the first number-like run (keeps digits, commas and a single dot).
  const match = text.replace(/ /g, " ").match(/(\d[\d,]*(?:\.\d+)?)/);
  if (!match) return null;

  const numeric = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  // Drop obvious noise (EMI "from ₹2,199/month" is still a valid number, but a
  // stray rating like "4.3" slipping through would be tiny — callers decide).
  return Math.round(numeric * 100) / 100;
};

export const detectCurrency = (input) => {
  if (!input) return "INR";
  const text = String(input).toLowerCase();
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (text.includes(symbol)) return code;
  }
  return "INR";
};

export const parseRating = (input) => {
  if (input === null || input === undefined) return null;
  const match = String(input).match(/([0-5](?:\.\d)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return value >= 0 && value <= 5 ? value : null;
};

export const parseReviewCount = (input) => {
  if (input === null || input === undefined) return null;
  const cleaned = String(input).replace(/[()]/g, " ").trim().toLowerCase();
  // Handle "1.2k", "3.4m", "2 lakh" as well as Indian-grouped "2,47,723".
  const unitMatch = cleaned.match(/([\d,.]+)\s*(k|lakh|l|m)\b/);
  if (unitMatch) {
    const value = Number(unitMatch[1].replace(/,/g, ""));
    if (!Number.isFinite(value)) return null;
    const unit = unitMatch[2];
    const factor = unit === "k" ? 1_000 : unit === "m" ? 1_000_000 : 100_000;
    return Math.round(value * factor);
  }
  const plain = cleaned.replace(/,/g, "").match(/\d+/);
  return plain ? Number(plain[0]) : null;
};

export const computeDiscountPercent = (price, originalPrice) => {
  if (!price || !originalPrice || originalPrice <= price) return null;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
};

/** Lowercase, collapse whitespace, drop punctuation that never carries meaning. */
export const canonicalizeText = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[|,/()\[\]{}:;!?"'’“”]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const detectBrand = (text) => {
  const canon = canonicalizeText(text);
  for (const brand of KNOWN_BRANDS) {
    if (new RegExp(`\\b${brand}\\b`).test(canon)) {
      return brand === "iphone" ? "apple" : brand;
    }
  }
  // "iPhone" implies Apple even though "apple" is not in the string.
  if (/\biphone\b|\bipad\b|\bmacbook\b|\bairpods\b/.test(canon)) return "apple";
  if (/\bgalaxy\b/.test(canon)) return "samsung";
  return null;
};

/**
 * Extract structured attributes (storage / ram / colour / size / screen) that
 * distinguish product variants from one another.
 */
export const extractSpecs = (text) => {
  const canon = canonicalizeText(text);
  const specs = {};

  // All "<n> gb|tb" occurrences. Larger value -> storage, smaller -> RAM.
  const capacities = [];
  const capRegex = /(\d+(?:\.\d+)?)\s*(gb|tb)\b/g;
  let m;
  while ((m = capRegex.exec(canon)) !== null) {
    let gb = Number(m[1]);
    if (m[2] === "tb") gb *= 1024;
    // Was this explicitly tagged as RAM?
    const tail = canon.slice(m.index, m.index + 20);
    capacities.push({ gb, isRam: /ram/.test(tail) });
  }
  if (capacities.length) {
    const ram = capacities.find((c) => c.isRam);
    const rest = capacities.filter((c) => c !== ram);
    if (ram) specs.ram = `${ram.gb}GB`;
    if (rest.length) {
      const storage = rest.reduce((a, b) => (b.gb > a.gb ? b : a));
      specs.storage = storage.gb >= 1024 ? `${storage.gb / 1024}TB` : `${storage.gb}GB`;
    } else if (!ram && capacities.length === 1) {
      // Single ambiguous value — treat >= 64GB as storage, else RAM.
      const only = capacities[0];
      if (only.gb >= 64) specs.storage = `${only.gb}GB`;
      else specs.ram = `${only.gb}GB`;
    }
    // Two untagged values: smaller is RAM, larger is storage.
    if (!ram && rest.length >= 2) {
      const sorted = [...rest].sort((a, b) => a.gb - b.gb);
      specs.ram = `${sorted[0].gb}GB`;
      specs.storage =
        sorted[sorted.length - 1].gb >= 1024
          ? `${sorted[sorted.length - 1].gb / 1024}TB`
          : `${sorted[sorted.length - 1].gb}GB`;
    }
  }

  const colour = COLOR_WORDS.find((c) => new RegExp(`\\b${c}\\b`).test(canon));
  if (colour) specs.color = colour === "gray" ? "grey" : colour;

  const screen = canon.match(/(\d{1,2}(?:\.\d)?)\s*(?:inch|"|inches|-inch)/);
  if (screen) specs.screen = `${screen[1]}in`;

  const shoeSize = canon.match(/\b(?:uk|us|eu)\s?(\d{1,2}(?:\.\d)?)\b/);
  if (shoeSize) specs.size = shoeSize[1];

  const apparel = canon.match(/\b(xxl|xl|xs|s|m|l)\b\s*(?:size)?/);
  if (apparel && !specs.storage && !specs.ram) specs.size = apparel[1].toUpperCase();

  return specs;
};

/**
 * The model core: title tokens with brand, colours, capacities and generic
 * marketing words stripped out. Used both for matching and for a human label.
 */
const STOPWORDS = new Set([
  "with",
  "and",
  "the",
  "for",
  "new",
  "latest",
  "buy",
  "online",
  "smartphone",
  "mobile",
  "phone",
  "laptop",
  "shoes",
  "shoe",
  "running",
  "sports",
  "casual",
  "men",
  "mens",
  "women",
  "womens",
  "unisex",
  "5g",
  "4g",
  "dual",
  "sim",
  "ram",
  "rom",
  "storage",
  "gb",
  "tb",
  "inch",
  "display",
  "camera",
]);

export const extractModelTokens = (text, brand) => {
  const canon = canonicalizeText(text);
  return canon
    .split(" ")
    .filter((tok) => tok && tok !== brand)
    .filter((tok) => !STOPWORDS.has(tok))
    .filter((tok) => !COLOR_WORDS.includes(tok))
    .filter((tok) => !/^\d+(gb|tb)$/.test(tok))
    .filter((tok) => tok.length > 1 || /\d/.test(tok));
};

/**
 * Turn a scraper's raw object into the canonical shape used everywhere else.
 * Every downstream consumer (matching, sorting, the API response, the future
 * Python advisor) sees only this structure.
 */
export const normalizeProduct = (raw, platform) => {
  const title = String(raw.title || "").trim();
  if (!title) return null;

  const price = parsePrice(raw.price);
  const originalPrice = parsePrice(raw.originalPrice);
  const brand = detectBrand(`${raw.brand || ""} ${title}`) || (raw.brand ? canonicalizeText(raw.brand) : null);
  const specs = { ...extractSpecs(title), ...(raw.specs || {}) };

  const discountPercent =
    computeDiscountPercent(price, originalPrice) ??
    (raw.discount ? parsePrice(String(raw.discount).replace("%", "")) : null);

  return {
    id: `${platform}:${hashString(raw.productUrl || title)}`,
    title,
    brand,
    price,
    originalPrice: originalPrice && price && originalPrice > price ? originalPrice : null,
    discountPercent,
    currency: detectCurrency(raw.price) || "INR",
    image: sanitizeUrl(raw.image),
    productUrl: sanitizeUrl(raw.productUrl),
    platform,
    rating: parseRating(raw.rating),
    reviewCount: parseReviewCount(raw.reviewCount),
    availability: raw.availability ? String(raw.availability).trim() : null,
    deliveryInfo: raw.deliveryInfo ? String(raw.deliveryInfo).trim() : null,
    category: raw.category ? String(raw.category).trim() : null,
    specs,
    modelTokens: extractModelTokens(title, brand),
    modelNumber: raw.modelNumber ? String(raw.modelNumber).trim() : null,
    variant: raw.variant ? String(raw.variant).trim() : null,
  };
};

/** Only allow http(s) URLs through — never `javascript:` / `data:` / relative. */
export const sanitizeUrl = (value) => {
  if (!value) return null;
  try {
    const url = new URL(String(value).trim());
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
    return null;
  } catch {
    return null;
  }
};

export const hashString = (str) => {
  let hash = 5381;
  const text = String(str);
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};
