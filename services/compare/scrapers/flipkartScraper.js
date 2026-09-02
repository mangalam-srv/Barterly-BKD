import { BaseScraper } from "./baseScraper.js";

/**
 * Flipkart search scraper.
 *
 * Flipkart ships two result layouts (a list view for electronics, a grid view
 * for fashion) and rotates its obfuscated class names frequently. To stay
 * resilient we anchor on stable hooks:
 *   - the product card is `div[data-id]` (data-id is the Flipkart product id)
 *   - the outbound link is the only `a[href*="/p/"]` in the card
 *   - the title is read from the product image `alt` / link `title`
 *   - prices are found by scanning for `₹NN,NNN` text nodes in DOM order
 *
 * Missing fields degrade to null. A blocked response yields zero cards and the
 * orchestrator reports the source as unavailable — never fabricated data.
 */
export class FlipkartScraper extends BaseScraper {
  platform = "flipkart";
  displayName = "Flipkart";
  allowedHosts = ["flipkart.com"];

  buildSearchUrl(query) {
    return `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
  }

  async extractProducts(page) {
    await page.waitForSelector('div[data-id], a[href*="/p/"]', { timeout: 5_000 }).catch(() => {});
    // The login pop-up overlays the grid on first load.
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(400);

    return page.evaluate(() => {
      const RUPEE = /₹\s?[\d,]+/g;

      const cards = Array.from(document.querySelectorAll("div[data-id]"));
      const scope = cards.length
        ? cards
        : Array.from(document.querySelectorAll('a[href*="/p/"]')).map((a) => a.closest("div") || a);

      const clean = (s) => (s ? s.replace(/\s+/g, " ").trim() : null);

      return scope
        .map((card) => {
          const link = card.querySelector('a[href*="/p/"]');
          if (!link) return null;
          const rawHref = link.getAttribute("href") || "";
          const path = rawHref.split("?")[0];
          const productUrl = path.startsWith("http")
            ? path
            : `https://www.flipkart.com${path}`;

          const img = card.querySelector("img");
          const titledLink = card.querySelector('a[href*="/p/"][title]');
          const brandText = clean(
            [".Fo1I0b", ".syl9yP"].map((s) => card.querySelector(s)).find(Boolean)?.textContent
          );
          let title =
            clean(titledLink && titledLink.getAttribute("title")) ||
            clean(link.getAttribute("title")) ||
            clean(img && img.getAttribute("alt")) ||
            clean(
              [".KzDlHZ", ".RG5Slk", "._4rR01T", ".wjcEIp", ".s1Q9rs", ".IRpwTa", ".blmWbh"]
                .map((s) => card.querySelector(s))
                .find(Boolean)?.textContent
            );
          if (!title) return null;
          // Fashion grid puts the brand in a separate node — prepend it so the
          // matcher can identify the brand.
          if (brandText && !title.toLowerCase().includes(brandText.toLowerCase())) {
            title = `${brandText} ${title}`;
          }

          // All ₹ amounts in DOM order: [0] = selling price, [1] = MRP (if larger).
          const amounts = [];
          const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            const matches = node.textContent.match(RUPEE);
            if (matches) {
              for (const m of matches) {
                const value = Number(m.replace(/[₹,\s]/g, ""));
                if (Number.isFinite(value) && value > 0) amounts.push(value);
              }
            }
          }
          const price = amounts[0] ? String(amounts[0]) : null;
          const mrp = amounts[1] && amounts[1] > amounts[0] ? String(amounts[1]) : null;

          const ratingEl =
            card.querySelector('[id^="productRating"]') ||
            card.querySelector("._3LWZlK, .XQDdHH, .Y1HWO0");
          const rating = clean(ratingEl && ratingEl.textContent);

          let reviewCount = null;
          const reviewEl = Array.from(card.querySelectorAll("span")).find((s) =>
            /\d[\d,]*\s+Ratings?/i.test(s.textContent)
          );
          if (reviewEl) {
            const m = reviewEl.textContent.match(/([\d,]+)\s+Ratings?/i);
            if (m) reviewCount = m[1];
          }

          let image = null;
          if (img) {
            const candidates = [
              img.getAttribute("src"),
              img.getAttribute("data-src"),
              (img.getAttribute("srcset") || "").split(" ")[0],
            ];
            image =
              candidates.find(
                (c) => c && !c.startsWith("data:") && !/placeholder|\.svg(\?|$)/i.test(c)
              ) || null;
            if (image) image = image.replace(/^\/\//, "https://");
          }

          return {
            title,
            productUrl,
            price,
            originalPrice: mrp,
            rating: rating && /^[0-5](\.\d)?$/.test(rating) ? rating : null,
            reviewCount,
            image,
            availability: null,
            deliveryInfo: null,
          };
        })
        .filter(Boolean);
    });
  }
}
