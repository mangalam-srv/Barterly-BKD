import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { internalOnly } from "../middleware/internalAuth.middleware.js";
import { runComparison } from "../services/compare/compareService.js";

const router = Router();

const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

/**
 * The AI service can trigger a comparison search, but not unboundedly — the same
 * cost limits as the public compare endpoint apply.
 */
const internalRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { statusCode: 429, success: false, message: "Internal comparison rate limit reached" },
});

/**
 * The single, tightly-scoped operation exposed to the Python AI service.
 * It accepts ONLY a free-text product query (never a URL) and reuses the exact
 * Prompt-1 comparison pipeline. Returns a slimmed structured result.
 *
 * POST /internal/compare-search   { "query": "MacBook Air M3" }
 */
router.post(
  "/compare-search",
  internalOnly,
  internalRateLimiter,
  asyncHandler(async (req, res) => {
    const raw = req.body?.query;
    if (typeof raw !== "string") {
      throw new ApiError(400, "query is required");
    }
    const query = raw.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    if (query.length < 2) {
      throw new ApiError(400, "query must be at least 2 characters");
    }
    if (!/[a-z0-9]/i.test(query)) {
      throw new ApiError(400, "query must contain letters or numbers");
    }

    const result = await runComparison(query, { useCache: true });

    // Slim the payload — the advisor only needs identity + price + rating + specs.
    const slimProduct = (p) => ({
      title: p.title,
      brand: p.brand ?? null,
      platform: p.platform ?? null,
      price: typeof p.price === "number" ? p.price : null,
      currency: p.currency ?? "INR",
      originalPrice: typeof p.originalPrice === "number" ? p.originalPrice : null,
      discountPercent: typeof p.discountPercent === "number" ? p.discountPercent : null,
      rating: typeof p.rating === "number" ? p.rating : null,
      reviewCount: typeof p.reviewCount === "number" ? p.reviewCount : null,
      productUrl: p.productUrl ?? null,
      specs: p.specs && typeof p.specs === "object" ? p.specs : {},
    });

    const slim = {
      query: result.query,
      products: (result.products || []).slice(0, 10).map(slimProduct),
      groups: (result.groups || []).slice(0, 4).map((g) => ({
        label: g.label,
        priceRange: g.priceRange ?? null,
        platforms: g.platforms ?? [],
        products: (g.products || []).slice(0, 6).map(slimProduct),
      })),
      cheapestOverall: result.cheapestOverall
        ? {
            title: result.cheapestOverall.title,
            platform: result.cheapestOverall.platform,
            price: result.cheapestOverall.price,
            productUrl: result.cheapestOverall.productUrl,
          }
        : null,
      sources: (result.sources || []).map((s) => ({
        platform: s.platform,
        displayName: s.displayName,
        status: s.status,
        count: s.count,
      })),
      meta: { totalResults: result.meta?.totalResults ?? 0, cached: !!result.meta?.cached },
    };

    return res.status(200).json(new ApiResponse(200, slim, "Internal comparison completed"));
  })
);

export default router;
