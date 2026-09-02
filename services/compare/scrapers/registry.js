import { AmazonScraper } from "./amazonScraper.js";
import { FlipkartScraper } from "./flipkartScraper.js";
import { MyntraScraper } from "./myntraScraper.js";

/**
 * Single place that decides which stores the comparison engine talks to.
 *
 * To add a new platform later:
 *   1. create `scrapers/<name>Scraper.js` extending BaseScraper
 *   2. add one entry to SCRAPER_CLASSES below (keyed by its platform id)
 * Nothing else in the pipeline needs to change.
 */
const SCRAPER_CLASSES = {
  amazon: AmazonScraper,
  flipkart: FlipkartScraper,
  myntra: MyntraScraper,
};

const DEFAULT_MAX_RESULTS = 12;

export const MAX_RESULTS_PER_SOURCE = (() => {
  const parsed = Number.parseInt(process.env.COMPARE_MAX_RESULTS_PER_SOURCE ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 40 ? parsed : DEFAULT_MAX_RESULTS;
})();

/** Platform ids that are enabled, honouring the optional COMPARE_SOURCES override. */
const enabledPlatformIds = () => {
  const raw = (process.env.COMPARE_SOURCES ?? "").trim();
  if (!raw) return Object.keys(SCRAPER_CLASSES);
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((id) => SCRAPER_CLASSES[id]);
};

export const createScrapers = () =>
  enabledPlatformIds().map(
    (id) => new SCRAPER_CLASSES[id]({ maxResults: MAX_RESULTS_PER_SOURCE })
  );

export const listPlatforms = () =>
  enabledPlatformIds().map((id) => {
    const instance = new SCRAPER_CLASSES[id]();
    return { platform: instance.platform, displayName: instance.displayName };
  });
