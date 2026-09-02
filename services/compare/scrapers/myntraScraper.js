import { BaseScraper } from "./baseScraper.js";

/**
 * Myntra search scraper.
 *
 * Myntra is a single-page React app that renders results into `li.product-base`
 * and hard-blocks obvious automation (it often returns an "Access Denied" page
 * to datacenter IPs). We wait for the product grid and read the standard
 * brand/name/price nodes. No grid -> no products -> source reported unavailable.
 */
export class MyntraScraper extends BaseScraper {
  platform = "myntra";
  displayName = "Myntra";
  allowedHosts = ["myntra.com"];

  buildSearchUrl(query) {
    const slug = query.trim().replace(/\s+/g, "-").toLowerCase();
    return `https://www.myntra.com/${encodeURIComponent(slug)}?rawQuery=${encodeURIComponent(query)}`;
  }

  async extractProducts(page) {
    await page.waitForSelector("li.product-base", { timeout: 12_000 }).catch(() => {});

    return page.$$eval("li.product-base", (items) => {
      const text = (root, sel) => {
        const el = root.querySelector(sel);
        return el ? el.textContent.trim() : null;
      };

      return items
        .map((item) => {
          const link = item.querySelector("a[href]");
          const href = link ? link.getAttribute("href") : null;
          const productUrl = href
            ? href.startsWith("http")
              ? href
              : `https://www.myntra.com/${href.replace(/^\//, "")}`
            : null;

          const brand = text(item, "h3.product-brand");
          const name = text(item, "h4.product-product");
          const priceEl =
            text(item, "span.product-discountedPrice") || text(item, "div.product-price span");
          const mrp = text(item, "span.product-strike");
          const rating = text(item, "div.product-ratingsContainer span");
          const ratingCount = text(item, "div.product-ratingsCount");
          const img = item.querySelector("img.img-responsive, picture img");

          return {
            title: [brand, name].filter(Boolean).join(" ") || name || brand,
            brand,
            productUrl,
            price: priceEl,
            originalPrice: mrp,
            rating,
            reviewCount: ratingCount,
            image: img ? img.getAttribute("src") : null,
            category: "fashion",
            availability: null,
            deliveryInfo: null,
          };
        })
        .filter((p) => p.title && p.productUrl);
    });
  }
}
