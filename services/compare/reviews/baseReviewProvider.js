import { acquireContext, releaseContext } from "../browserManager.js";

/**
 * Extensible review-source architecture.
 *
 * Prompt 1's product scrapers capture ratings + review COUNTS but not review
 * TEXT (that lives on individual product pages). A review provider fills that
 * gap for one platform: given a product URL it returns a handful of visible
 * customer-review snippets. Everything runs through Node/Playwright — Python
 * never scrapes.
 *
 * Providers only ever navigate to their own `allowedHosts`. No CAPTCHA solving,
 * no anti-bot evasion — if a page blocks us the provider returns [] and the
 * caller degrades gracefully (the advisor already handles "reviews unavailable").
 *
 * Add a platform:  create `<name>ReviewProvider.js` extending this class and
 * register it in `reviewRegistry.js`.
 */
export class BaseReviewProvider {
  /** @type {string} lowercase platform id, e.g. "flipkart" */
  platform = "base";

  /** Hosts this provider is allowed to open. */
  allowedHosts = [];

  constructor({ navTimeoutMs = 15_000, maxReviews = 8 } = {}) {
    this.navTimeoutMs = navTimeoutMs;
    this.maxReviews = maxReviews;
  }

  /** Whether this provider can handle the given product URL. */
  canHandle(productUrl) {
    try {
      const host = new URL(productUrl).hostname;
      return this.allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
    } catch {
      return false;
    }
  }

  /** Subclass hook: return review strings from the loaded page. */
  // eslint-disable-next-line no-unused-vars
  async extractReviews(page) {
    throw new Error(`${this.platform}: extractReviews not implemented`);
  }

  /** Subclass hook: the page to actually open (defaults to the product URL). */
  reviewsUrl(productUrl) {
    return productUrl.split("?")[0];
  }

  /**
   * Fetch review text for a product page.
   * @returns {Promise<{ reviews: string[], platform: string, note?: string }>}
   */
  async fetchReviews(productUrl) {
    if (!this.canHandle(productUrl)) {
      return { reviews: [], platform: this.platform, note: "unsupported URL" };
    }

    let context;
    let page;
    try {
      context = await acquireContext();
      page = await context.newPage();
      await page.route("**/*", (route) => {
        const type = route.request().resourceType();
        if (["media", "font", "image"].includes(type)) return route.abort();
        return route.continue();
      });

      await page.goto(this.reviewsUrl(productUrl), {
        waitUntil: "domcontentloaded",
        timeout: this.navTimeoutMs,
      });
      await page.keyboard.press("Escape").catch(() => {});
      await page.evaluate(async () => {
        for (let y = 0; y < 6000; y += 700) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 200));
        }
      }).catch(() => {});
      await page.waitForTimeout(400);

      const raw = await this.extractReviews(page);
      const reviews = (Array.isArray(raw) ? raw : [])
        .map((r) => String(r || "").replace(/\s+/g, " ").trim())
        .filter((r) => r.length >= 20 && r.length <= 1200)
        .slice(0, this.maxReviews);

      return {
        reviews,
        platform: this.platform,
        note: reviews.length ? undefined : "no review text found on the page",
      };
    } catch (err) {
      return {
        reviews: [],
        platform: this.platform,
        note: `could not load reviews (${(err?.message || "error").slice(0, 80)})`,
      };
    } finally {
      try {
        if (page) await page.close();
      } catch {
        /* ignore */
      }
      await releaseContext(context);
    }
  }
}
