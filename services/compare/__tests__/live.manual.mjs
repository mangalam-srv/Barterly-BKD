/**
 * LIVE integration check — actually launches Chromium and hits Amazon/Flipkart/
 * Myntra. Network-dependent and may report sources as blocked; that is a valid
 * outcome, not a failure.
 *
 * Run:  node services/compare/__tests__/live.manual.mjs "iPhone 15 128GB"
 */
import { runComparison } from "../compareService.js";
import { closeBrowser } from "../browserManager.js";

const query = process.argv[2] || "iPhone 15 128GB";

const main = async () => {
  console.log(`\nComparing: "${query}"\n`);
  const result = await runComparison(query, {
    logger: (m) => console.log("  ·", m),
    useCache: false,
  });

  console.log("\n--- SOURCES ---");
  for (const s of result.sources) {
    console.log(
      `  ${s.displayName.padEnd(9)} ${s.status.padEnd(8)} ${String(s.count).padStart(2)} results  (${s.elapsedMs}ms)` +
        (s.message ? `  — ${s.message}` : "")
    );
  }

  console.log("\n--- GROUPS ---");
  result.groups.slice(0, 5).forEach((g, i) => {
    console.log(`\n  [${i + 1}] ${g.label}`);
    console.log(`      specs: ${JSON.stringify(g.specs)}  platforms: ${g.platforms.join(", ")}`);
    g.products.forEach((p) => {
      console.log(
        `      ${p.isBestPrice ? "🏆" : "  "} ${p.platform.padEnd(9)} ` +
          `${p.price ? "₹" + p.price.toLocaleString("en-IN") : "n/a"}`.padEnd(16) +
          (p.rating ? `★${p.rating} ` : "") +
          `\n         ${p.productUrl}`
      );
    });
  });

  console.log("\n--- CHEAPEST OVERALL ---");
  console.log("  ", result.cheapestOverall || "none");
  console.log("\n--- META ---");
  console.log("  ", result.meta);

  await closeBrowser();
};

main().catch(async (err) => {
  console.error("FATAL:", err);
  await closeBrowser();
  process.exit(1);
});
