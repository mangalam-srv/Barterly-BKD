import { acquireContext, releaseContext } from "../browserManager.js";

/**
 * Error type that carries the platform name so the orchestrator can report a
 * per-source failure without aborting the whole comparison request.
 */
export class ScraperError extends Error {
  constructor(platform, message, cause) {
    super(message);
    this.name = "ScraperError";
    this.platform = platform;
    this.cause = cause;
  }
}

/**
 * Every platform scraper extends this class and implements two things:
 *
 *   buildSearchUrl(query)        -> absolute search-results URL
 *   async extractProducts(page)  -> Array<raw product>  (raw, un-normalized)
 *
 * The base class owns everything else: context/page lifecycle, navigation with
 * one retry, timeouts, result capping and consistent error wrapping. Adding a
 * new store therefore means writing ~2 methods, nothing more.
 */
export class BaseScraper {
  /** @type {string} unique lowercase platform id, e.g. "amazon" */
  platform = "base";

  /** @type {string} label shown in the UI, e.g. "Amazon" */
  displayName = "Base";

  /** Domains this scraper is ever allowed to navigate to. */
  allowedHosts = [];

  constructor({ maxResults = 12, navTimeoutMs = 12_000 } = {}) {
    this.maxResults = maxResults;
    this.navTimeoutMs = navTimeoutMs;
  }

  // eslint-disable-next-line no-unused-vars
  buildSearchUrl(query) {
    throw new Error(`${this.platform}: buildSearchUrl not implemented`);
  }

  // eslint-disable-next-line no-unused-vars
  async extractProducts(page, query) {
    throw new Error(`${this.platform}: extractProducts not implemented`);
  }

  assertAllowedUrl(url) {
    let host;
    try {
      host = new URL(url).hostname;
    } catch {
      throw new ScraperError(this.platform, `Invalid search URL: ${url}`);
    }
    const ok = this.allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
    if (!ok) {
      throw new ScraperError(this.platform, `Blocked navigation target: ${host}`);
    }
  }

  /**
   * Run the scraper end-to-end for a query. Always resolves to
   * `{ platform, products: rawProduct[] }` or throws a ScraperError.
   */
  async search(query, { logger } = {}) {
    const log = logger || (() => {});
    const url = this.buildSearchUrl(query);
    this.assertAllowedUrl(url);

    let context;
    let page;
    try {
      context = await acquireContext();
      page = await context.newPage();

      // Block heavy resources we never need — keeps scrapes fast and light.
      // NOTE: images are allowed through: several stores only swap the real
      // product-image URL into the DOM once the <img> actually loads.
      await page.route("**/*", (route) => {
        const type = route.request().resourceType();
        if (["media", "font"].includes(type)) return route.abort();
        return route.continue();
      });

      log(`${this.displayName}: fetching results`);
      await this.#gotoWithRetry(page, url);
      await this.#nudgeLazyContent(page);

      const raw = await this.extractProducts(page, query);
      const products = (Array.isArray(raw) ? raw : [])
        .filter((p) => p && p.title && p.productUrl)
        .slice(0, this.maxResults);

      log(`${this.displayName}: ${products.length} raw results`);
      return { platform: this.platform, products };
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError(this.platform, err?.message || "Scrape failed", err);
    } finally {
      try {
        if (page) await page.close();
      } catch {
        /* ignore */
      }
      await releaseContext(context);
    }
  }

  /** Scroll the page in steps so lazy-loaded cards / images get a chance to render. */
  async #nudgeLazyContent(page) {
    try {
      await page.evaluate(async () => {
        const step = Math.max(400, Math.floor(window.innerHeight * 0.8));
        for (let y = 0; y < 4000; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 250));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(400);
    } catch {
      /* non-fatal — extraction can still proceed */
    }
  }

  async #gotoWithRetry(page, url) {
    let lastErr;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: this.navTimeoutMs });
        return;
      } catch (err) {
        lastErr = err;
        await page.waitForTimeout(500 * attempt);
      }
    }
    throw new ScraperError(this.platform, `Navigation failed: ${lastErr?.message}`, lastErr);
  }
}
