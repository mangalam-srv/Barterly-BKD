import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { runComparison } from "../services/compare/compareService.js";
import { listPlatforms } from "../services/compare/scrapers/registry.js";
import {
  getReviews,
  supportedReviewHosts,
  supportedReviewPlatforms,
} from "../services/compare/reviews/reviewService.js";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

// Matches ASCII control characters (0x00-0x1F and 0x7F).
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

/**
 * Validate + sanitize a raw search string.
 * Throws ApiError(400) on anything we should not hand to a scraper.
 */
const sanitizeQuery = (value) => {
  if (typeof value !== "string") {
    throw new ApiError(400, "Search query is required");
  }

  const cleaned = value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();

  if (cleaned.length < MIN_QUERY_LENGTH) {
    throw new ApiError(400, `Search query must be at least ${MIN_QUERY_LENGTH} characters`);
  }
  if (cleaned.length > MAX_QUERY_LENGTH) {
    throw new ApiError(400, `Search query must be ${MAX_QUERY_LENGTH} characters or fewer`);
  }
  if (!/[a-z0-9]/i.test(cleaned)) {
    throw new ApiError(400, "Search query must contain letters or numbers");
  }

  return cleaned;
};

/**
 * GET /api/v1/compare?q=<product>
 * Runs the full scrape -> normalize -> match -> price-sort pipeline.
 */
export const compareProducts = asyncHandler(async (req, res) => {
  const query = sanitizeQuery(req.query.q ?? req.query.query);
  const noCache = req.query.fresh === "1" || req.query.fresh === "true";

  const result = await runComparison(query, { useCache: !noCache });

  const everySourceFailed =
    result.sources.length > 0 && result.sources.every((s) => s.status === "failed");

  if (everySourceFailed) {
    // Surface as an upstream failure, but keep the structured source breakdown
    // so the UI can still show which stores were tried.
    return res
      .status(502)
      .json(new ApiResponse(502, result, "All price sources are currently unavailable"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Price comparison completed"));
});

/**
 * GET /api/v1/compare/sources
 * Lightweight metadata endpoint — which stores the engine supports.
 */
export const getCompareSources = asyncHandler(async (_req, res) => {
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          platforms: listPlatforms(),
          reviewPlatforms: supportedReviewPlatforms(),
        },
        "Supported price sources"
      )
    );
});

/**
 * GET /api/v1/compare/reviews?url=<product page url>
 * Lazily fetches visible customer-review text for a product page so the AI
 * Advisor can ground review questions. Cached 30 min. Never fabricates reviews —
 * returns an empty list (with a note) when a store blocks automated access.
 */
export const getProductReviews = asyncHandler(async (req, res) => {
  const raw = typeof req.query.url === "string" ? req.query.url.trim() : "";
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new ApiError(400, "A valid product URL is required");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ApiError(400, "Only http(s) product URLs are supported");
  }
  const hosts = supportedReviewHosts();
  const allowed = hosts.some(
    (h) => url.hostname === h || url.hostname.endsWith(`.${h}`)
  );
  if (!allowed) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          reviews: [],
          platform: null,
          cached: false,
          note: `Review text is only available for: ${hosts.join(", ")}`,
        },
        "No review source for this URL"
      )
    );
  }

  const result = await getReviews(url.toString());
  return res
    .status(200)
    .json(new ApiResponse(200, result, "Product reviews"));
});
