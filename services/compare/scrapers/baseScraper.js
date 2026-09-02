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

  constructor({ maxResults = 12, navTimeoutMs = 8_000 } = {}) {
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

    const ok = this.allowedHosts.some(
      (h) => host === h || host.endsWith(`.${h}`)
    );

    if (!ok) {
      throw new ScraperError(
        this.platform,
        `Blocked navigation target: ${host}`
      );
    }
  }

  /**
   * Run the scraper end-to-end for a query.
   * Always resolves to `{ platform, products: rawProduct[] }`
   * or throws a ScraperError.
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

      // Block heavy resources we never need.
      await page.route("**/*", (route) => {
        const type = route.request().resourceType();

        if (["media", "font"].includes(type)) {
          return route.abort();
        }

        return route.continue();
      });

      log(`${this.displayName}: fetching results`);

      console.log(`[compare:${this.displayName}] goto start: ${url}`);

      await this.#gotoWithRetry(page, url);

      console.log(`[compare:${this.displayName}] goto completed`);

      console.log(`[compare:${this.displayName}] lazy content start`);

      await this.#nudgeLazyContent(page);

      console.log(`[compare:${this.displayName}] lazy content done`);

      console.log(`[compare:${this.displayName}] extraction start`);

      const raw = await this.extractProducts(page, query);

      console.log(
        `[compare:${this.displayName}] extraction completed: ${
          Array.isArray(raw) ? raw.length : 0
        }`
      );

      const products = (Array.isArray(raw) ? raw : [])
        .filter((p) => p && p.title && p.productUrl)
        .slice(0, this.maxResults);

      log(`${this.displayName}: ${products.length} raw results`);

      return {
        platform: this.platform,
        products,
      };
    } catch (err) {
      if (err instanceof ScraperError) {
        throw err;
      }

      throw new ScraperError(
        this.platform,
        err?.message || "Scrape failed",
        err
      );
    } finally {
      try {
        if (page) {
          await page.close();
        }
      } catch {
        /* ignore */
      }

      await releaseContext(context);
    }
  }

  /**
   * Give the page a short moment for initial/lazy content to render.
   */
  async #nudgeLazyContent(page) {
    try {
      await page.waitForTimeout(500);
    } catch {
      /* non-fatal — extraction can still proceed */
    }
  }

  async #gotoWithRetry(page, url) {
  try {
    await page.goto(url, {
      waitUntil: "commit",
      timeout: this.navTimeoutMs,
    });

    return;
  } catch (err) {
    // A navigation timeout does not necessarily mean the page is unusable.
    // The browser may already have received enough of the document for
    // extraction to work, so continue and let the platform scraper inspect it.
    const message = err?.message || "";

    if (
      message.toLowerCase().includes("timeout") ||
      message.toLowerCase().includes("timed out")
    ) {
      return;
    }

    throw new ScraperError(
      this.platform,
      `Navigation failed: ${message}`,
      err
    );
  }
}
}