/**
 * Manual, no-network sanity check for the deterministic parts of the compare
 * pipeline (price parsing, spec extraction, relevance, grouping, sorting).
 *
 * Run:  node services/compare/__tests__/pipeline.manual.mjs
 */
import assert from "node:assert/strict";
import { parsePrice, extractSpecs, normalizeProduct } from "../normalize.js";
import { parseQueryIntent, relevanceScore, groupProducts, RELEVANCE_THRESHOLD } from "../matching.js";

let passed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}\n      ${err.message}`);
    process.exitCode = 1;
  }
};

// --- price parsing ---
check("parsePrice handles rupee + commas", () => assert.equal(parsePrice("₹1,29,900"), 129900));
check("parsePrice handles 'Rs. 47999.00'", () => assert.equal(parsePrice("Rs. 47999.00"), 47999));
check("parsePrice rejects junk", () => assert.equal(parsePrice("Currently unavailable"), null));
check("parsePrice passes numbers through", () => assert.equal(parsePrice(51999), 51999));

// --- spec extraction ---
check("extractSpecs: iphone storage", () => {
  const s = extractSpecs("Apple iPhone 15 (128 GB) - Black");
  assert.equal(s.storage, "128GB");
  assert.equal(s.color, "black");
});
check("extractSpecs: ram + storage", () => {
  const s = extractSpecs("Samsung Galaxy S24 5G (8GB RAM, 256GB Storage) Marble Grey");
  assert.equal(s.ram, "8GB");
  assert.equal(s.storage, "256GB");
  assert.equal(s.color, "grey");
});

// --- relevance: 128GB query must reject a 256GB product ---
const intent = parseQueryIntent("iPhone 15 128GB Black");
const p128 = normalizeProduct(
  { title: "Apple iPhone 15 128GB Black", price: "₹65,999", productUrl: "https://www.amazon.in/dp/A1" },
  "amazon"
);
const p256 = normalizeProduct(
  { title: "Apple iPhone 15 256GB Blue", price: "₹75,999", productUrl: "https://www.flipkart.com/p/x2" },
  "flipkart"
);
const pCase = normalizeProduct(
  { title: "Spigen Silicone Back Cover Case for iPhone 15", price: "₹799", productUrl: "https://www.amazon.in/dp/A3" },
  "amazon"
);
check("relevance: matching variant scores high", () =>
  assert.ok(relevanceScore(p128, intent) >= RELEVANCE_THRESHOLD)
);
check("relevance: wrong storage scores low", () =>
  assert.ok(relevanceScore(p256, intent) < RELEVANCE_THRESHOLD)
);
check("relevance: accessory scores low", () =>
  assert.ok(relevanceScore(pCase, intent) < RELEVANCE_THRESHOLD)
);

// --- grouping + ascending price sort ---
const a = normalizeProduct(
  { title: "Apple iPhone 15 (128 GB) - Black", price: "₹65,999", productUrl: "https://www.amazon.in/dp/B1" },
  "amazon"
);
const f = normalizeProduct(
  { title: "APPLE iPhone 15 (Black, 128 GB)", price: "₹62,499", productUrl: "https://www.flipkart.com/p/B2" },
  "flipkart"
);
const groups = groupProducts([a, f]);
check("grouping: same variant across stores groups together", () => {
  assert.equal(groups.length, 1);
  assert.equal(groups[0].productCount, 2);
});
check("grouping: cheapest is first and flagged", () => {
  assert.equal(groups[0].products[0].platform, "flipkart");
  assert.equal(groups[0].products[0].price, 62499);
  assert.equal(groups[0].products[0].isBestPrice, true);
  assert.equal(groups[0].cheapest.price, 62499);
});
check("grouping: different storage stays separate", () => {
  const g2 = groupProducts([a, normalizeProduct(
    { title: "Apple iPhone 15 (256 GB) - Black", price: "₹75,999", productUrl: "https://www.amazon.in/dp/B9" },
    "amazon"
  )]);
  assert.equal(g2.length, 2);
});

console.log(`\n${passed} checks passed`);
