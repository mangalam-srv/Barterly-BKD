import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  advisorChat,
  advisorChatStream,
  advisorStatus,
  listAdvisorConversations,
  getAdvisorConversation,
  removeAdvisorConversation,
  resolveProductKey,
} from "../controllers/advisor.controller.js";
import { optionalAuth } from "../middleware/optionalAuth.middleware.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

/**
 * Every advisor turn triggers an LLM call in the Python service, so this is
 * rate-limited more tightly than ordinary endpoints. Consistent with the
 * limiter added for /api/v1/compare in Prompt 1.
 */
const advisorRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    statusCode: 429,
    success: false,
    message: "You're sending questions too quickly. Please wait a moment and try again.",
  },
});

router.get("/health", advisorStatus);
router.post("/chat", advisorRateLimiter, optionalAuth, advisorChat);
router.post("/chat/stream", advisorRateLimiter, optionalAuth, advisorChatStream);
router.post("/product-key", optionalAuth, resolveProductKey);

// Persistent conversations — authentication required (ownership enforced).
router.get("/conversations", protect, listAdvisorConversations);
router.get("/conversations/:id", protect, getAdvisorConversation);
router.delete("/conversations/:id", protect, removeAdvisorConversation);

export default router;
