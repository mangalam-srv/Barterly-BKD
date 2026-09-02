import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  compareProducts,
  getCompareSources,
  getProductReviews,
} from "../controllers/compare.controller.js";

const router = Router();

/**
 * Price comparison drives real headless-browser scrapes, so it is far more
 * expensive than a normal API call. Cap how often a single client can trigger it.
 */
const compareRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    statusCode: 429,
    success: false,
    message: "Too many comparison requests. Please wait a minute and try again.",
  },
});

// Review fetches also open a browser page — rate-limit them, a bit more generously.
const reviewRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    statusCode: 429,
    success: false,
    message: "Too many review requests. Please wait a moment and try again.",
  },
});

router.get("/sources", getCompareSources);
router.get("/reviews", reviewRateLimiter, getProductReviews);
router.get("/", compareRateLimiter, compareProducts);

export default router;
