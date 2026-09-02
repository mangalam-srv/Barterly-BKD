import { BaseScraper } from "./baseScraper.js";

/**
 * Amazon India search scraper.
 *
 * Amazon aggressively rate-limits / CAPTCHA-gates datacenter traffic, so it will
 * frequently refuse the connection or serve a bot page. When that happens the
 * base class turns the navigation error into a per-source failure and the
 * orchestrator carries on with the other stores — it never invents data.
 *
 * When Amazon *does* answer, we read the standard `s-search-result` grid. Amazon
 * rotates the title markup often, so title/link/price are each read from a list
 * of candidate selectors, picking the best non-empty value.
 */
export class AmazonScraper extends BaseScraper {
  platform = "amazon";
  displayName = "Amazon";
  allowedHosts = ["amazon.in", "amazon.com"];

  buildSearchUrl(query) {
    return `https://www.amazon.in/s?k=${encodeURIComponent(query)}&ref=nb_sb_noss`;
  }

  async extractProducts(page) {
    await page
      .waitForSelector('div[data-component-type="s-search-result"]', { timeout: 10_000 })
      .catch(() => {});

    return page.$$eval(
      'div[data-component-type="s-search-result"]',
      (nodes) => {
        const clean = (s) => (s ? s.replace(/\s+/g, " ").trim() : null);

        const longestText = (root, selectors) => {
          let best = null;
          for (const sel of selectors) {
            for (const el of root.querySelectorAll(sel)) {
              const t = clean(el.textContent);
              if (t && (!best || t.length > best.length)) best = t;
            }
          }
          return best;
        };

        return nodes.map((node) => {
          const title = longestText(node, [
            '[data-cy="title-recipe"] h2 span',
            "h2 a span",
            "h2 span",
            ".a-size-medium.a-color-base.a-text-normal",
            ".a-size-base-plus.a-color-base.a-text-normal",
          ]);

          const linkEl =
            node.querySelector('[data-cy="title-recipe"] a[href]') ||
            node.querySelector("h2 a[href]") ||
            node.querySelector('a.a-link-normal[href*="/dp/"]') ||
            node.querySelector('a.a-link-normal[href*="/gp/"]');
          const href = linkEl ? linkEl.getAttribute("href") : null;
          const productUrl = href
            ? href.startsWith("http")
              ? href.split("?")[0]
              : `https://www.amazon.in${href.split("?")[0]}`
            : null;

          const priceOff = node.querySelector(".a-price:not(.a-text-price) > .a-offscreen");
          const priceWhole = node.querySelector(".a-price-whole");
          const strike = node.querySelector(".a-price.a-text-price > .a-offscreen");

          const ratingEl = node.querySelector('[aria-label*="out of 5 stars"] , i.a-icon-star-small .a-icon-alt, .a-icon-alt');
          const reviewsEl = node.querySelector(
            'a[href*="#customerReviews"] span, [aria-label*="ratings"], .a-size-base.s-underline-text'
          );
          const imgEl = node.querySelector("img.s-image");
          const deliveryEl = node.querySelector('[data-cy="delivery-recipe"]');

          return {
            title,
            productUrl,
            price:
              clean(priceOff && priceOff.textContent) ||
              (priceWhole ? `₹${clean(priceWhole.textContent)}` : null),
            originalPrice: clean(strike && strike.textContent),
            rating:
              (ratingEl && (ratingEl.getAttribute("aria-label") || clean(ratingEl.textContent))) ||
              null,
            reviewCount:
              (reviewsEl &&
                (reviewsEl.getAttribute("aria-label") || clean(reviewsEl.textContent))) ||
              null,
            image: imgEl ? imgEl.getAttribute("src") : null,
            deliveryInfo: clean(deliveryEl && deliveryEl.textContent),
            availability: null,
          };
        });
      }
    );
  }
}
